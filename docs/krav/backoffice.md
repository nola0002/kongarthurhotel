# Back office: funktionelle krav (receptionist)

Afskrift af kravboardet (se [README](README.md)). De præcise krav står i
[`specs/001-backoffice-bookinger/spec.md`](../../specs/001-backoffice-bookinger/spec.md), og
status står i [`converge.md`](../../specs/001-backoffice-bookinger/converge.md).

| ID | Krav | Kilde | Bruger | Prioritet | Præciseret i (spec 001) |
|---|---|---|---|---|---|
| FR1 | Oprette, redigere og slette bookinger via en frontend | Softwarearkitektur | Receptionist og hoteladministrator | Must | FR-003, FR-004, FR-005 |
| FR2 | Hente en liste af bookinger (forudsætning for at kunne redigere) | Afledt af FR1 | Receptionist og hoteladministrator | Must | FR-001 |
| FR3 | Kunne slette en booking og bekræfte sletningen, før den udføres | – | – | – | FR-005, SC-005 |
| FR4 | Receptionisten kan se en liste over bookinger | – | – | – | FR-001 |
| FR5 | Receptionisten kan søge eller filtrere bookinger på gæstenavn og dato | – | – | – | FR-002 |
| FR6 | Systemet afviser en booking, hvis antal gæster overstiger værelsestypens kapacitet | – | – | – | FR-006 |
| FR7 | Systemet forhindrer, at et værelse bookes to gange i samme periode | – | – | – | FR-007, FR-016 |
| FR8 | Systemet viser prisen for opholdet, beregnet ud fra værelsestype, sæson og antal nætter | – | – | – | FR-008, FR-009 |
| FR9 | Receptionisten kan registrere et salg i baren (drink og antal) | – | – | – | FR-010, FR-010a, FR-011 |

Spec 001 tilføjer tre krav, som ikke står på boardet: login (FR-015), danske fejlbeskeder
(FR-014) og bookinger fra hotellets eget bookingsystem (FR-013, fra `T10`).
