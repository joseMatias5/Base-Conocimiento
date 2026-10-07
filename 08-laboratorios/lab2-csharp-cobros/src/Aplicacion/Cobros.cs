using Dominio;

namespace Aplicacion;

public enum ResultadoCobro { Cobrado, YaCobradoOAnulado, NoExiste, Repetido }

/// <summary>Puerto: la capa de aplicación no conoce Npgsql (arquitectura hexagonal).</summary>
public interface ICobrosRepositorio
{
    /// <summary>Cobra de forma atómica: reclama el estado, registra el cobro y el evento (outbox) en una sola transacción.</summary>
    Task<ResultadoCobro> CobrarAsync(int pedidoId, string claveIdempotencia, CancellationToken ct);
}

public sealed class CobrarPedido(ICobrosRepositorio repo)
{
    public Task<ResultadoCobro> EjecutarAsync(int pedidoId, string? claveIdempotencia, CancellationToken ct = default)
    {
        if (pedidoId <= 0) throw new ArgumentOutOfRangeException(nameof(pedidoId));
        if (string.IsNullOrWhiteSpace(claveIdempotencia)) throw new ArgumentException("Falta la clave de idempotencia", nameof(claveIdempotencia));
        Estados.Exigir(EstadoPedido.Abierto, EstadoPedido.Cobrado); // la regla vive en el dominio
        return repo.CobrarAsync(pedidoId, claveIdempotencia, ct);
    }
}
