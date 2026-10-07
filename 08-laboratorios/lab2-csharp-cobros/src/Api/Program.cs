using Aplicacion;
using Infraestructura;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);
var cadena = builder.Configuration.GetConnectionString("Base") ?? throw new InvalidOperationException("Falta ConnectionStrings:Base"); // secretos obligatorios (L-023)
builder.Services.AddSingleton(NpgsqlDataSource.Create(cadena));
builder.Services.AddSingleton<ICobrosRepositorio, CobrosNpgsql>();
builder.Services.AddSingleton<CobrarPedido>();
var app = builder.Build();

// Errores con forma única { error }, sin filtrar detalles internos.
app.UseExceptionHandler(a => a.Run(async ctx =>
{
    ctx.Response.StatusCode = 500;
    await ctx.Response.WriteAsJsonAsync(new { error = "Error interno" });
}));

app.MapPost("/pedidos/{id:int}/cobrar", async (int id, HttpRequest req, CobrarPedido caso, CancellationToken ct) =>
{
    var clave = req.Headers["Idempotency-Key"].ToString();
    if (string.IsNullOrWhiteSpace(clave)) return Results.BadRequest(new { error = "Falta el encabezado Idempotency-Key" });
    return await caso.EjecutarAsync(id, clave, ct) switch
    {
        ResultadoCobro.Cobrado => Results.Ok(new { estado = "cobrado" }),
        ResultadoCobro.Repetido => Results.Ok(new { estado = "cobrado", repetido = true }),
        ResultadoCobro.YaCobradoOAnulado => Results.Conflict(new { error = "El pedido ya fue cobrado o anulado" }),
        _ => Results.NotFound(new { error = "Pedido inexistente" }),
    };
});

app.Run();

public partial class Program;
