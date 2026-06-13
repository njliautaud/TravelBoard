/** Curated hub airports users commonly fly out of (IATA code). */
export interface AirportOption {
  iata: string;
  name: string;
  city: string;
  country: string;
}

export const HOME_AIRPORTS: AirportOption[] = [
  { iata: "ATL", name: "Hartsfield–Jackson", city: "Atlanta", country: "USA" },
  { iata: "LAX", name: "Los Angeles Intl", city: "Los Angeles", country: "USA" },
  { iata: "ORD", name: "O'Hare", city: "Chicago", country: "USA" },
  { iata: "DFW", name: "Dallas/Fort Worth", city: "Dallas", country: "USA" },
  { iata: "DEN", name: "Denver Intl", city: "Denver", country: "USA" },
  { iata: "JFK", name: "John F. Kennedy", city: "New York", country: "USA" },
  { iata: "EWR", name: "Newark Liberty", city: "New York", country: "USA" },
  { iata: "LGA", name: "LaGuardia", city: "New York", country: "USA" },
  { iata: "SFO", name: "San Francisco Intl", city: "San Francisco", country: "USA" },
  { iata: "SEA", name: "Seattle–Tacoma", city: "Seattle", country: "USA" },
  { iata: "LAS", name: "Harry Reid Intl", city: "Las Vegas", country: "USA" },
  { iata: "MCO", name: "Orlando Intl", city: "Orlando", country: "USA" },
  { iata: "MIA", name: "Miami Intl", city: "Miami", country: "USA" },
  { iata: "PHX", name: "Phoenix Sky Harbor", city: "Phoenix", country: "USA" },
  { iata: "IAH", name: "George Bush", city: "Houston", country: "USA" },
  { iata: "BOS", name: "Logan Intl", city: "Boston", country: "USA" },
  { iata: "MSP", name: "Minneapolis–St. Paul", city: "Minneapolis", country: "USA" },
  { iata: "DTW", name: "Detroit Metro", city: "Detroit", country: "USA" },
  { iata: "PHL", name: "Philadelphia Intl", city: "Philadelphia", country: "USA" },
  { iata: "CLT", name: "Charlotte Douglas", city: "Charlotte", country: "USA" },
  { iata: "SAN", name: "San Diego Intl", city: "San Diego", country: "USA" },
  { iata: "PDX", name: "Portland Intl", city: "Portland", country: "USA" },
  { iata: "IAD", name: "Dulles Intl", city: "Washington DC", country: "USA" },
  { iata: "DCA", name: "Reagan National", city: "Washington DC", country: "USA" },
  { iata: "AUS", name: "Austin–Bergstrom", city: "Austin", country: "USA" },
  { iata: "SLC", name: "Salt Lake City Intl", city: "Salt Lake City", country: "USA" },
  { iata: "BNA", name: "Nashville Intl", city: "Nashville", country: "USA" },
  { iata: "RDU", name: "Raleigh–Durham", city: "Raleigh", country: "USA" },
  { iata: "HNL", name: "Daniel K. Inouye", city: "Honolulu", country: "USA" },
  { iata: "YYZ", name: "Pearson Intl", city: "Toronto", country: "Canada" },
  { iata: "YVR", name: "Vancouver Intl", city: "Vancouver", country: "Canada" },
  { iata: "LHR", name: "Heathrow", city: "London", country: "UK" },
  { iata: "LGW", name: "Gatwick", city: "London", country: "UK" },
  { iata: "CDG", name: "Charles de Gaulle", city: "Paris", country: "France" },
  { iata: "AMS", name: "Schiphol", city: "Amsterdam", country: "Netherlands" },
  { iata: "FRA", name: "Frankfurt", city: "Frankfurt", country: "Germany" },
  { iata: "MUC", name: "Munich", city: "Munich", country: "Germany" },
  { iata: "MAD", name: "Barajas", city: "Madrid", country: "Spain" },
  { iata: "BCN", name: "El Prat", city: "Barcelona", country: "Spain" },
  { iata: "FCO", name: "Fiumicino", city: "Rome", country: "Italy" },
  { iata: "MXP", name: "Malpensa", city: "Milan", country: "Italy" },
  { iata: "ZRH", name: "Zurich", city: "Zurich", country: "Switzerland" },
  { iata: "IST", name: "Istanbul", city: "Istanbul", country: "Turkey" },
  { iata: "DXB", name: "Dubai Intl", city: "Dubai", country: "UAE" },
  { iata: "DOH", name: "Hamad Intl", city: "Doha", country: "Qatar" },
  { iata: "SIN", name: "Changi", city: "Singapore", country: "Singapore" },
  { iata: "HKG", name: "Hong Kong Intl", city: "Hong Kong", country: "China" },
  { iata: "NRT", name: "Narita", city: "Tokyo", country: "Japan" },
  { iata: "HND", name: "Haneda", city: "Tokyo", country: "Japan" },
  { iata: "ICN", name: "Incheon", city: "Seoul", country: "South Korea" },
  { iata: "SYD", name: "Kingsford Smith", city: "Sydney", country: "Australia" },
  { iata: "MEL", name: "Tullamarine", city: "Melbourne", country: "Australia" },
  { iata: "AKL", name: "Auckland", city: "Auckland", country: "New Zealand" },
  { iata: "GRU", name: "Guarulhos", city: "São Paulo", country: "Brazil" },
  { iata: "EZE", name: "Ezeiza", city: "Buenos Aires", country: "Argentina" },
  { iata: "MEX", name: "Benito Juárez", city: "Mexico City", country: "Mexico" },
  { iata: "CUN", name: "Cancún Intl", city: "Cancún", country: "Mexico" },
];

export function airportLabel(iata: string): string {
  const a = HOME_AIRPORTS.find((x) => x.iata === iata);
  return a ? `${a.iata} — ${a.city}` : iata;
}
