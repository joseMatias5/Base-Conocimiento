using System.Net;
using Aplicacion;
using Dominio;
using Infraestructura;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace Pruebas;

public class DominioTests
{
    [Fact] public void Linea_3_por_1250_50_con_10_por_ciento_da_3376_35() =>
        Assert.Equal(337_635, Dinero.Linea(3, Dinero.Desde(125_050), 1000).Centavos);

    [Fact] public void Descuento_redondea_half_up() =>
        Assert.Equal(94, Dinero.Linea(1, Dinero.Desde(105), 1000).Centavos); // descuento 10,5 sube a 11 => 105 - 11 = 94

    [Fact] public void Dinero_negativo_se_rechaza() => Assert.Throws<ArgumentOutOfRangeException>(() => Dinero.Desde(-1));

    [Theory]
    [InlineData(EstadoPedido.Abierto, EstadoPedido.Cobrado, true)]
    [InlineData(EstadoPedido.Cobrado, EstadoPedido.Abierto, false)] // un pedido cobrado no se reabre
    [InlineData(EstadoPedido.Anulado, EstadoPedido.Cobrado, false)]
    [InlineData(EstadoPedido.Cobrado, EstadoPedido.Anulado, true)]
    public void Maquina_de_estados(EstadoPedido d, EstadoPedido h, bool ok) => Assert.Equal(ok, Estados.Permite(d, h));

    [Fact] public void Transicion_invalida_lanza() =>
        Assert.Throws<TransicionInvalidaException>(() => Estados.Exigir(EstadoPedido.Cobrado, EstadoPedido.Abierto));
}

[Collection("pg")]
public class ConcurrenciaTests(PostgresFixture pg)
{
    private CobrarPedido Caso() => new(new CobrosNpgsql(pg.Origen));

    [Fact]
    public async Task Cincuenta_cobros_simultaneos_con_claves_distintas_solo_uno_gana()
    {
        await pg.Reiniciar(); await pg.CrearPedido();
        var caso = Caso();
        var res = await Task.WhenAll(Enumerable.Range(0, 50).Select(i => caso.EjecutarAsync(1, $"k{i}")));
        Assert.Equal(1, res.Count(r => r == ResultadoCobro.Cobrado));
        Assert.Equal(49, res.Count(r => r == ResultadoCobro.YaCobradoOAnulado));
        Assert.Equal(1, await pg.Contar("cobro"));   // el rollback también deshizo el registro de los 49 perdedores
        Assert.Equal(1, await pg.Contar("outbox"));
    }

    [Fact]
    public async Task Reintentos_con_la_misma_clave_son_idempotentes()
    {
        await pg.Reiniciar(); await pg.CrearPedido();
        var caso = Caso();
        var res = await Task.WhenAll(Enumerable.Range(0, 20).Select(_ => caso.EjecutarAsync(1, "misma-clave")));
        Assert.Equal(1, res.Count(r => r == ResultadoCobro.Cobrado));
        Assert.All(res.Where(r => r != ResultadoCobro.Cobrado), r => Assert.Contains(r, new[] { ResultadoCobro.Repetido, ResultadoCobro.YaCobradoOAnulado }));
        Assert.Equal(1, await pg.Contar("cobro"));
    }

    [Fact]
    public async Task Pedido_inexistente_devuelve_NoExiste_sin_efectos()
    {
        await pg.Reiniciar();
        Assert.Equal(ResultadoCobro.NoExiste, await Caso().EjecutarAsync(99, "x"));
        Assert.Equal(0, await pg.Contar("outbox"));
    }

    [Fact]
    public async Task Entrada_invalida_se_rechaza_antes_de_tocar_la_base()
    {
        await Assert.ThrowsAsync<ArgumentException>(() => Caso().EjecutarAsync(1, " "));
        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() => Caso().EjecutarAsync(0, "k"));
    }
}

[Collection("pg")]
public class ApiTests(PostgresFixture pg)
{
    // En hosting mínimo, Program lee la configuración antes de que el test pueda sobrescribirla: se usa una variable de entorno.
    private HttpClient Cliente()
    {
        Environment.SetEnvironmentVariable("ConnectionStrings__Base", pg.Cadena);
        return new WebApplicationFactory<Program>().CreateClient();
    }

    private static HttpRequestMessage Post(int id, string? clave)
    {
        var r = new HttpRequestMessage(HttpMethod.Post, $"/pedidos/{id}/cobrar");
        if (clave is not null) r.Headers.Add("Idempotency-Key", clave);
        return r;
    }

    [Fact]
    public async Task Cobrar_por_HTTP_200_luego_409_y_404_y_400()
    {
        await pg.Reiniciar(); await pg.CrearPedido();
        var c = Cliente();
        Assert.Equal(HttpStatusCode.OK, (await c.SendAsync(Post(1, "a"))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await c.SendAsync(Post(1, "a"))).StatusCode);        // mismo reintento: idempotente
        Assert.Equal(HttpStatusCode.Conflict, (await c.SendAsync(Post(1, "b"))).StatusCode);   // otra clave: ya cobrado
        Assert.Equal(HttpStatusCode.NotFound, (await c.SendAsync(Post(77, "c"))).StatusCode);
        var sinClave = await c.SendAsync(Post(1, null));
        Assert.Equal(HttpStatusCode.BadRequest, sinClave.StatusCode);
        Assert.Contains("\"error\"", await sinClave.Content.ReadAsStringAsync());              // forma única { error }
        Assert.Equal("cobrado", await pg.Estado(1));
    }
}
