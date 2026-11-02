# Data model: Enterprise back office (005)

Skemaet er uændret bortset fra to kolonner. Alt andet er afledt i services.

## bookings (ændret)

| Kolonne | Type | Regel |
|---|---|---|
| `checked_in_at` | `DATETIME NULL` | Sættes af `POST /bookings/{id}/check-in`, kun når status er `arriving` |
| `checked_out_at` | `DATETIME NULL` | Sættes af `POST /bookings/{id}/check-out`, kun når status er `departing` |

## Afledt status (bookingService.deriveStatus)

| Status | Regel (today = dags dato, Europe/Copenhagen) |
|---|---|
| `upcoming` | today < checkIn |
| `arriving` | today = checkIn og ikke tjekket ind |
| `in_house` | checkIn ≤ today < checkOut, og tjekket ind eller checkIn < today |
| `departing` | today = checkOut og ikke tjekket ud |
| `checked_out` | today = checkOut og tjekket ud |
| `departed` | today > checkOut |

Overgange: `arriving` → (tjek ind) → `in_house` → … → `departing` → (tjek ud) → `checked_out`.

## Afledte strukturer (gemmes ikke)

- **Folio**: booking + nætter (dato, sæson, andel af prisen) + barsalg på bookingen + regning.
- **Ordre**: kassens kurv i React. Bliver til ét `bar_sales`-række pr. linje.
- **Omsætning**: aggregater over `bar_sales` og fordelte værelsesnætter for en periode.
- **Prisliste**: `room_prices` pr. værelsestype og sæson (eksisterende tabel).
