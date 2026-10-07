using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using Infraestructura;
using Npgsql;

namespace Pruebas;

/// <summary>Levanta un PostgreSQL real (binarios del Lab 1) en carpeta temporal y puerto libre. Sin Docker, sin instalación.</summary>
public sealed class PostgresFixture : IAsyncLifetime
{
    private string _dir = "";
    public int Puerto { get; private set; }
    public string Cadena => $"Host=localhost;Port={Puerto};Username=lab;Database=postgres;Pooling=true;Maximum Pool Size=60";
    public NpgsqlDataSource Origen { get; private set; } = null!;

    private static string Bin()
    {
        var d = new DirectoryInfo(AppContext.BaseDirectory);
        while (d is not null && !Directory.Exists(Path.Combine(d.FullName, "lab1-postgres-concurrencia"))) d = d.Parent;
        return Path.Combine(d?.FullName ?? throw new DirectoryNotFoundException("No se encontró lab1-postgres-concurrencia (ejecutar `npm install` allí)"),
            "lab1-postgres-concurrencia", "node_modules", "@embedded-postgres", "windows-x64", "native", "bin");
    }

    /// <summary>pg_ctl start deja el servidor heredando las tuberías: nunca redirigir su salida o ReadToEnd no termina.</summary>
    private static void Ejecutar(string exe, string args, bool capturar = true)
    {
        var p = Process.Start(new ProcessStartInfo(exe, args) { RedirectStandardOutput = capturar, RedirectStandardError = capturar, UseShellExecute = false, CreateNoWindow = true })!;
        var err = capturar ? p.StandardError.ReadToEndAsync() : null;
        if (capturar) p.StandardOutput.ReadToEnd();
        if (!p.WaitForExit(60_000)) { p.Kill(true); throw new TimeoutException($"{exe} {args}"); }
        if (p.ExitCode != 0) throw new InvalidOperationException($"{exe} {args}{Environment.NewLine}{err?.Result}");
    }

    public async Task InitializeAsync()
    {
        _dir = Path.Combine(Path.GetTempPath(), "lab2-pg-" + Guid.NewGuid().ToString("N")[..8]);
        var l = new TcpListener(IPAddress.Loopback, 0); l.Start(); Puerto = ((IPEndPoint)l.LocalEndpoint).Port; l.Stop();
        var bin = Bin();
        Ejecutar(Path.Combine(bin, "initdb.exe"), $"-D \"{_dir}\" -U lab --auth=trust -E UTF8");
        Ejecutar(Path.Combine(bin, "pg_ctl.exe"), $"-D \"{_dir}\" -o \"-p {Puerto}\" -l \"{_dir}.log\" -w start", capturar: false);
        Origen = NpgsqlDataSource.Create(Cadena);
        await using var c = Origen.CreateCommand(CobrosNpgsql.Esquema);
        await c.ExecuteNonQueryAsync();
    }

    public async Task Reiniciar()
    {
        await using var c = Origen.CreateCommand("TRUNCATE pedido, cobro, outbox RESTART IDENTITY CASCADE");
        await c.ExecuteNonQueryAsync();
    }

    public async Task<long> Contar(string tabla)
    {
        await using var c = Origen.CreateCommand($"SELECT count(*) FROM {tabla}");
        return (long)(await c.ExecuteScalarAsync())!;
    }

    public async Task<string> Estado(int id)
    {
        await using var c = Origen.CreateCommand($"SELECT estado FROM pedido WHERE id={id}");
        return (string)(await c.ExecuteScalarAsync())!;
    }

    public async Task CrearPedido(long total = 10_000)
    {
        await using var c = Origen.CreateCommand($"INSERT INTO pedido(total_centavos) VALUES ({total})");
        await c.ExecuteNonQueryAsync();
    }

    public async Task DisposeAsync()
    {
        await Origen.DisposeAsync();
        NpgsqlConnection.ClearAllPools();
        try { Ejecutar(Path.Combine(Bin(), "pg_ctl.exe"), $"-D \"{_dir}\" -m immediate stop", capturar: false); } catch { /* ya detenido */ }
        try { Directory.Delete(_dir, true); File.Delete(_dir + ".log"); } catch { /* temporal */ }
    }
}

[CollectionDefinition("pg")]
public class PgCollection : ICollectionFixture<PostgresFixture>;
