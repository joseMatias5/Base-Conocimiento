namespace Dominio;

/// <summary>Dinero en enteros de la unidad mínima (centavos). Nunca double ni decimal flotante (L-001).</summary>
public readonly record struct Dinero(long Centavos)
{
    public static Dinero Desde(long centavos) =>
        centavos < 0 ? throw new ArgumentOutOfRangeException(nameof(centavos), "El dinero no puede ser negativo") : new(centavos);

    /// <summary>Total de línea: cantidad × precio unitario, con descuento en puntos básicos (1000 = 10 %), redondeo half-up.</summary>
    public static Dinero Linea(int cantidad, Dinero precioUnitario, int descuentoPuntosBasicos = 0)
    {
        if (cantidad <= 0) throw new ArgumentOutOfRangeException(nameof(cantidad));
        if (descuentoPuntosBasicos is < 0 or > 10_000) throw new ArgumentOutOfRangeException(nameof(descuentoPuntosBasicos));
        var bruto = checked(cantidad * precioUnitario.Centavos);
        var descuento = (bruto * descuentoPuntosBasicos + 5_000) / 10_000;
        return new(bruto - descuento);
    }
}

public enum EstadoPedido { Abierto, Cobrado, Anulado }

public sealed class TransicionInvalidaException(EstadoPedido desde, EstadoPedido hacia)
    : Exception($"Transición no permitida: {desde} → {hacia}");

/// <summary>Máquina de estados explícita (L-012): solo Abierto puede cobrarse o anularse; Cobrado solo se anula por asiento inverso.</summary>
public static class Estados
{
    public static bool Permite(EstadoPedido desde, EstadoPedido hacia) => (desde, hacia) switch
    {
        (EstadoPedido.Abierto, EstadoPedido.Cobrado) => true,
        (EstadoPedido.Abierto, EstadoPedido.Anulado) => true,
        (EstadoPedido.Cobrado, EstadoPedido.Anulado) => true,
        _ => false,
    };

    public static void Exigir(EstadoPedido desde, EstadoPedido hacia)
    {
        if (!Permite(desde, hacia)) throw new TransicionInvalidaException(desde, hacia);
    }
}
