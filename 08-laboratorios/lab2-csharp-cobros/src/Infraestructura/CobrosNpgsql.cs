using Aplicacion;
using Npgsql;

namespace Infraestructura;

public sealed class CobrosNpgsql(NpgsqlDataSource origen) : ICobrosRepositorio
{
    public const string Esquema = """
        CREATE TABLE IF NOT EXISTS pedido (id serial PRIMARY KEY, estado text NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto','cobrado','anulado')), total_centavos bigint NOT NULL);
        CREATE TABLE IF NOT EXISTS cobro (id serial PRIMARY KEY, pedido_id int NOT NULL REFERENCES pedido(id), clave text NOT NULL UNIQUE);
        CREATE TABLE IF NOT EXISTS outbox (id serial PRIMARY KEY, evento text NOT NULL, procesado boolean NOT NULL DEFAULT false);
        """;

    public async Task<ResultadoCobro> CobrarAsync(int pedidoId, string clave, CancellationToken ct)
    {
        for (var intento = 0; ; intento++)
        {
            await using var cn = await origen.OpenConnectionAsync(ct);
            await using var tx = await cn.BeginTransactionAsync(ct);
            try
            {
                // 1) Idempotencia: la misma clave nunca cobra dos veces.
                await using (var c = new NpgsqlCommand("INSERT INTO cobro(pedido_id, clave) SELECT id, @k FROM pedido WHERE id=@p ON CONFLICT (clave) DO NOTHING", cn, tx))
                {
                    c.Parameters.AddWithValue("k", clave);
                    c.Parameters.AddWithValue("p", pedidoId);
                    if (await c.ExecuteNonQueryAsync(ct) == 0)
                    {
                        await tx.RollbackAsync(ct);
                        return await ExisteAsync(pedidoId, ct) ? ResultadoCobro.Repetido : ResultadoCobro.NoExiste;
                    }
                }
                // 2) Escritura condicional: reclamar el estado.
                await using (var u = new NpgsqlCommand("UPDATE pedido SET estado='cobrado' WHERE id=@p AND estado='abierto'", cn, tx))
                {
                    u.Parameters.AddWithValue("p", pedidoId);
                    if (await u.ExecuteNonQueryAsync(ct) == 0)
                    {
                        await tx.RollbackAsync(ct); // deshace también el registro de cobro
                        return ResultadoCobro.YaCobradoOAnulado;
                    }
                }
                // 3) Outbox en la misma transacción.
                await using (var o = new NpgsqlCommand("INSERT INTO outbox(evento) VALUES (@e)", cn, tx))
                {
                    o.Parameters.AddWithValue("e", $"pedido.cobrado:{pedidoId}");
                    await o.ExecuteNonQueryAsync(ct);
                }
                await tx.CommitAsync(ct);
                return ResultadoCobro.Cobrado;
            }
            catch (PostgresException e) when ((e.SqlState is "40001" or "40P01") && intento < 5)
            {
                // se reintenta la transacción entera (L-061)
            }
        }
    }

    private async Task<bool> ExisteAsync(int pedidoId, CancellationToken ct)
    {
        await using var c = origen.CreateCommand("SELECT 1 FROM pedido WHERE id=@p");
        c.Parameters.AddWithValue("p", pedidoId);
        return await c.ExecuteScalarAsync(ct) is not null;
    }
}
