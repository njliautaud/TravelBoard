/** Curated hub airports users commonly fly out of (IATA code). */
export interface AirportOption {
  iata: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
}

export const HOME_AIRPORTS: AirportOption[] = [
  // --- USA Major Hubs ---
  { iata: "ATL", name: "Hartsfield-Jackson", city: "Atlanta", country: "USA", lat: 33.6407, lon: -84.4277 },
  { iata: "LAX", name: "Los Angeles Intl", city: "Los Angeles", country: "USA", lat: 33.9425, lon: -118.4081 },
  { iata: "ORD", name: "O'Hare", city: "Chicago", country: "USA", lat: 41.9742, lon: -87.9073 },
  { iata: "DFW", name: "Dallas/Fort Worth", city: "Dallas", country: "USA", lat: 32.8998, lon: -97.0403 },
  { iata: "DEN", name: "Denver Intl", city: "Denver", country: "USA", lat: 39.8561, lon: -104.6737 },
  { iata: "JFK", name: "John F. Kennedy", city: "New York", country: "USA", lat: 40.6413, lon: -73.7781 },
  { iata: "EWR", name: "Newark Liberty", city: "Newark", country: "USA", lat: 40.6895, lon: -74.1745 },
  { iata: "LGA", name: "LaGuardia", city: "New York", country: "USA", lat: 40.7769, lon: -73.8740 },
  { iata: "SFO", name: "San Francisco Intl", city: "San Francisco", country: "USA", lat: 37.6213, lon: -122.3790 },
  { iata: "SEA", name: "Seattle-Tacoma", city: "Seattle", country: "USA", lat: 47.4502, lon: -122.3088 },
  { iata: "LAS", name: "Harry Reid Intl", city: "Las Vegas", country: "USA", lat: 36.0840, lon: -115.1537 },
  { iata: "MCO", name: "Orlando Intl", city: "Orlando", country: "USA", lat: 28.4312, lon: -81.3081 },
  { iata: "MIA", name: "Miami Intl", city: "Miami", country: "USA", lat: 25.7959, lon: -80.2870 },
  { iata: "FLL", name: "Fort Lauderdale-Hollywood", city: "Fort Lauderdale", country: "USA", lat: 26.0742, lon: -80.1506 },
  { iata: "PHX", name: "Phoenix Sky Harbor", city: "Phoenix", country: "USA", lat: 33.4373, lon: -112.0078 },
  { iata: "IAH", name: "George Bush Intercontinental", city: "Houston", country: "USA", lat: 29.9902, lon: -95.3368 },
  { iata: "HOU", name: "William P. Hobby", city: "Houston", country: "USA", lat: 29.6454, lon: -95.2789 },
  { iata: "BOS", name: "Logan Intl", city: "Boston", country: "USA", lat: 42.3656, lon: -71.0096 },
  { iata: "MSP", name: "Minneapolis-St. Paul", city: "Minneapolis", country: "USA", lat: 44.8848, lon: -93.2223 },
  { iata: "DTW", name: "Detroit Metro", city: "Detroit", country: "USA", lat: 42.2162, lon: -83.3554 },
  { iata: "PHL", name: "Philadelphia Intl", city: "Philadelphia", country: "USA", lat: 39.8744, lon: -75.2424 },
  { iata: "CLT", name: "Charlotte Douglas", city: "Charlotte", country: "USA", lat: 35.2140, lon: -80.9431 },
  { iata: "SAN", name: "San Diego Intl", city: "San Diego", country: "USA", lat: 32.7338, lon: -117.1933 },
  { iata: "PDX", name: "Portland Intl", city: "Portland", country: "USA", lat: 45.5898, lon: -122.5951 },
  { iata: "IAD", name: "Dulles Intl", city: "Washington DC", country: "USA", lat: 38.9531, lon: -77.4565 },
  { iata: "DCA", name: "Reagan National", city: "Washington DC", country: "USA", lat: 38.8512, lon: -77.0402 },
  { iata: "AUS", name: "Austin-Bergstrom", city: "Austin", country: "USA", lat: 30.1975, lon: -97.6664 },
  { iata: "SLC", name: "Salt Lake City Intl", city: "Salt Lake City", country: "USA", lat: 40.7884, lon: -111.9778 },
  { iata: "BNA", name: "Nashville Intl", city: "Nashville", country: "USA", lat: 36.1263, lon: -86.6774 },
  { iata: "RDU", name: "Raleigh-Durham", city: "Raleigh", country: "USA", lat: 35.8801, lon: -78.7880 },
  { iata: "HNL", name: "Daniel K. Inouye", city: "Honolulu", country: "USA", lat: 21.3187, lon: -157.9224 },
  // --- USA Medium / Regional ---
  { iata: "TPA", name: "Tampa Intl", city: "Tampa", country: "USA", lat: 27.9756, lon: -82.5333 },
  { iata: "RSW", name: "Southwest Florida Intl", city: "Fort Myers", country: "USA", lat: 26.5362, lon: -81.7552 },
  { iata: "JAX", name: "Jacksonville Intl", city: "Jacksonville", country: "USA", lat: 30.4941, lon: -81.6879 },
  { iata: "PBI", name: "Palm Beach Intl", city: "West Palm Beach", country: "USA", lat: 26.6832, lon: -80.0956 },
  { iata: "SRQ", name: "Sarasota-Bradenton", city: "Sarasota", country: "USA", lat: 27.3954, lon: -82.5544 },
  { iata: "PIE", name: "St. Pete-Clearwater", city: "St. Petersburg", country: "USA", lat: 27.9114, lon: -82.6874 },
  { iata: "BWI", name: "Baltimore/Washington", city: "Baltimore", country: "USA", lat: 39.1754, lon: -76.6684 },
  { iata: "MDW", name: "Midway", city: "Chicago", country: "USA", lat: 41.7868, lon: -87.7522 },
  { iata: "DAL", name: "Dallas Love Field", city: "Dallas", country: "USA", lat: 32.8471, lon: -96.8518 },
  { iata: "SAT", name: "San Antonio Intl", city: "San Antonio", country: "USA", lat: 29.5337, lon: -98.4698 },
  { iata: "MCI", name: "Kansas City Intl", city: "Kansas City", country: "USA", lat: 39.2976, lon: -94.7139 },
  { iata: "STL", name: "St. Louis Lambert", city: "St. Louis", country: "USA", lat: 38.7487, lon: -90.3700 },
  { iata: "IND", name: "Indianapolis Intl", city: "Indianapolis", country: "USA", lat: 39.7173, lon: -86.2944 },
  { iata: "CMH", name: "John Glenn Columbus", city: "Columbus", country: "USA", lat: 39.9980, lon: -82.8919 },
  { iata: "CLE", name: "Cleveland Hopkins", city: "Cleveland", country: "USA", lat: 41.4058, lon: -81.8539 },
  { iata: "PIT", name: "Pittsburgh Intl", city: "Pittsburgh", country: "USA", lat: 40.4957, lon: -80.2413 },
  { iata: "CVG", name: "Cincinnati/Northern Kentucky", city: "Cincinnati", country: "USA", lat: 39.0488, lon: -84.6678 },
  { iata: "MKE", name: "Milwaukee Mitchell", city: "Milwaukee", country: "USA", lat: 42.9472, lon: -87.8966 },
  { iata: "OAK", name: "Oakland Intl", city: "Oakland", country: "USA", lat: 37.7213, lon: -122.2208 },
  { iata: "SJC", name: "San Jose Mineta", city: "San Jose", country: "USA", lat: 37.3626, lon: -121.9290 },
  { iata: "SMF", name: "Sacramento Intl", city: "Sacramento", country: "USA", lat: 38.6954, lon: -121.5908 },
  { iata: "SNA", name: "John Wayne / Orange County", city: "Santa Ana", country: "USA", lat: 33.6757, lon: -117.8681 },
  { iata: "BUR", name: "Hollywood Burbank", city: "Burbank", country: "USA", lat: 34.1975, lon: -118.3587 },
  { iata: "ONT", name: "Ontario Intl", city: "Ontario", country: "USA", lat: 34.0560, lon: -117.6012 },
  { iata: "ABQ", name: "Albuquerque Sunport", city: "Albuquerque", country: "USA", lat: 35.0402, lon: -106.6091 },
  { iata: "OMA", name: "Eppley Airfield", city: "Omaha", country: "USA", lat: 41.3032, lon: -95.8941 },
  { iata: "RIC", name: "Richmond Intl", city: "Richmond", country: "USA", lat: 37.5052, lon: -77.3197 },
  { iata: "BDL", name: "Bradley Intl", city: "Hartford", country: "USA", lat: 41.9389, lon: -72.6832 },
  { iata: "PVD", name: "T.F. Green", city: "Providence", country: "USA", lat: 41.7268, lon: -71.4284 },
  { iata: "BUF", name: "Buffalo Niagara", city: "Buffalo", country: "USA", lat: 42.9405, lon: -78.7322 },
  { iata: "SYR", name: "Syracuse Hancock", city: "Syracuse", country: "USA", lat: 43.1112, lon: -76.1063 },
  { iata: "MEM", name: "Memphis Intl", city: "Memphis", country: "USA", lat: 35.0424, lon: -89.9767 },
  { iata: "MSY", name: "Louis Armstrong", city: "New Orleans", country: "USA", lat: 29.9934, lon: -90.2580 },
  { iata: "SDF", name: "Louisville Muhammad Ali", city: "Louisville", country: "USA", lat: 38.1744, lon: -85.7360 },
  { iata: "OKC", name: "Will Rogers World", city: "Oklahoma City", country: "USA", lat: 35.3931, lon: -97.6007 },
  { iata: "TUL", name: "Tulsa Intl", city: "Tulsa", country: "USA", lat: 36.1984, lon: -95.8881 },
  { iata: "ANC", name: "Ted Stevens Anchorage", city: "Anchorage", country: "USA", lat: 61.1743, lon: -149.9962 },
  { iata: "OGG", name: "Kahului", city: "Maui", country: "USA", lat: 20.8986, lon: -156.4305 },
  { iata: "LIH", name: "Lihue", city: "Kauai", country: "USA", lat: 21.9760, lon: -159.3390 },
  { iata: "KOA", name: "Kona Intl", city: "Kailua-Kona", country: "USA", lat: 19.7388, lon: -156.0456 },
  { iata: "ORF", name: "Norfolk Intl", city: "Norfolk", country: "USA", lat: 36.8946, lon: -76.2012 },
  { iata: "GSP", name: "Greenville-Spartanburg", city: "Greenville", country: "USA", lat: 34.8957, lon: -82.2189 },
  { iata: "CHS", name: "Charleston Intl", city: "Charleston", country: "USA", lat: 32.8986, lon: -80.0405 },
  { iata: "SAV", name: "Savannah/Hilton Head", city: "Savannah", country: "USA", lat: 32.1276, lon: -81.2021 },
  { iata: "MYR", name: "Myrtle Beach Intl", city: "Myrtle Beach", country: "USA", lat: 33.6797, lon: -78.9283 },
  { iata: "DSM", name: "Des Moines Intl", city: "Des Moines", country: "USA", lat: 41.5341, lon: -93.6631 },
  { iata: "LIT", name: "Clinton National", city: "Little Rock", country: "USA", lat: 34.7294, lon: -92.2243 },
  { iata: "GRR", name: "Gerald R. Ford", city: "Grand Rapids", country: "USA", lat: 42.8808, lon: -85.5228 },
  { iata: "ELP", name: "El Paso Intl", city: "El Paso", country: "USA", lat: 31.8072, lon: -106.3778 },
  { iata: "TUS", name: "Tucson Intl", city: "Tucson", country: "USA", lat: 32.1161, lon: -110.9410 },
  { iata: "BOI", name: "Boise Airport", city: "Boise", country: "USA", lat: 43.5644, lon: -116.2228 },
  // --- Canada ---
  { iata: "YYZ", name: "Pearson Intl", city: "Toronto", country: "Canada", lat: 43.6777, lon: -79.6248 },
  { iata: "YVR", name: "Vancouver Intl", city: "Vancouver", country: "Canada", lat: 49.1967, lon: -123.1815 },
  { iata: "YUL", name: "Montreal-Trudeau", city: "Montreal", country: "Canada", lat: 45.4706, lon: -73.7408 },
  { iata: "YYC", name: "Calgary Intl", city: "Calgary", country: "Canada", lat: 51.1215, lon: -114.0076 },
  { iata: "YOW", name: "Ottawa Macdonald-Cartier", city: "Ottawa", country: "Canada", lat: 45.3225, lon: -75.6692 },
  { iata: "YEG", name: "Edmonton Intl", city: "Edmonton", country: "Canada", lat: 53.3097, lon: -113.5800 },
  { iata: "YWG", name: "Winnipeg Richardson", city: "Winnipeg", country: "Canada", lat: 49.9100, lon: -97.2399 },
  { iata: "YHZ", name: "Halifax Stanfield", city: "Halifax", country: "Canada", lat: 44.8808, lon: -63.5085 },
  // --- Europe ---
  { iata: "LHR", name: "Heathrow", city: "London", country: "UK", lat: 51.4700, lon: -0.4543 },
  { iata: "LGW", name: "Gatwick", city: "London", country: "UK", lat: 51.1537, lon: -0.1821 },
  { iata: "STN", name: "Stansted", city: "London", country: "UK", lat: 51.8860, lon: 0.2389 },
  { iata: "MAN", name: "Manchester", city: "Manchester", country: "UK", lat: 53.3537, lon: -2.2750 },
  { iata: "EDI", name: "Edinburgh", city: "Edinburgh", country: "UK", lat: 55.9500, lon: -3.3725 },
  { iata: "CDG", name: "Charles de Gaulle", city: "Paris", country: "France", lat: 49.0097, lon: 2.5479 },
  { iata: "ORY", name: "Orly", city: "Paris", country: "France", lat: 48.7262, lon: 2.3652 },
  { iata: "AMS", name: "Schiphol", city: "Amsterdam", country: "Netherlands", lat: 52.3105, lon: 4.7683 },
  { iata: "FRA", name: "Frankfurt", city: "Frankfurt", country: "Germany", lat: 50.0379, lon: 8.5622 },
  { iata: "MUC", name: "Munich", city: "Munich", country: "Germany", lat: 48.3537, lon: 11.7750 },
  { iata: "BER", name: "Berlin Brandenburg", city: "Berlin", country: "Germany", lat: 52.3667, lon: 13.5033 },
  { iata: "MAD", name: "Barajas", city: "Madrid", country: "Spain", lat: 40.4983, lon: -3.5676 },
  { iata: "BCN", name: "El Prat", city: "Barcelona", country: "Spain", lat: 41.2974, lon: 2.0833 },
  { iata: "FCO", name: "Fiumicino", city: "Rome", country: "Italy", lat: 41.8003, lon: 12.2389 },
  { iata: "MXP", name: "Malpensa", city: "Milan", country: "Italy", lat: 45.6306, lon: 8.7281 },
  { iata: "ZRH", name: "Zurich", city: "Zurich", country: "Switzerland", lat: 47.4647, lon: 8.5492 },
  { iata: "GVA", name: "Geneva", city: "Geneva", country: "Switzerland", lat: 46.2381, lon: 6.1089 },
  { iata: "IST", name: "Istanbul", city: "Istanbul", country: "Turkey", lat: 41.2753, lon: 28.7519 },
  { iata: "DUB", name: "Dublin", city: "Dublin", country: "Ireland", lat: 53.4264, lon: -6.2499 },
  { iata: "LIS", name: "Lisbon Humberto Delgado", city: "Lisbon", country: "Portugal", lat: 38.7742, lon: -9.1342 },
  { iata: "VIE", name: "Vienna Intl", city: "Vienna", country: "Austria", lat: 48.1103, lon: 16.5697 },
  { iata: "CPH", name: "Copenhagen", city: "Copenhagen", country: "Denmark", lat: 55.6181, lon: 12.6561 },
  { iata: "OSL", name: "Gardermoen", city: "Oslo", country: "Norway", lat: 60.1939, lon: 11.1004 },
  { iata: "ARN", name: "Arlanda", city: "Stockholm", country: "Sweden", lat: 59.6519, lon: 17.9186 },
  { iata: "HEL", name: "Helsinki-Vantaa", city: "Helsinki", country: "Finland", lat: 60.3172, lon: 24.9633 },
  { iata: "ATH", name: "Athens Intl", city: "Athens", country: "Greece", lat: 37.9364, lon: 23.9445 },
  { iata: "WAW", name: "Chopin", city: "Warsaw", country: "Poland", lat: 52.1657, lon: 20.9671 },
  { iata: "PRG", name: "Vaclav Havel", city: "Prague", country: "Czech Republic", lat: 50.1008, lon: 14.2600 },
  { iata: "BUD", name: "Budapest Ferenc Liszt", city: "Budapest", country: "Hungary", lat: 47.4369, lon: 19.2556 },
  { iata: "BRU", name: "Brussels", city: "Brussels", country: "Belgium", lat: 50.9014, lon: 4.4844 },
  // --- Middle East ---
  { iata: "DXB", name: "Dubai Intl", city: "Dubai", country: "UAE", lat: 25.2532, lon: 55.3657 },
  { iata: "DOH", name: "Hamad Intl", city: "Doha", country: "Qatar", lat: 25.2609, lon: 51.6138 },
  { iata: "AUH", name: "Abu Dhabi Intl", city: "Abu Dhabi", country: "UAE", lat: 24.4330, lon: 54.6511 },
  { iata: "TLV", name: "Ben Gurion", city: "Tel Aviv", country: "Israel", lat: 32.0055, lon: 34.8854 },
  // --- Asia-Pacific ---
  { iata: "SIN", name: "Changi", city: "Singapore", country: "Singapore", lat: 1.3644, lon: 103.9915 },
  { iata: "HKG", name: "Hong Kong Intl", city: "Hong Kong", country: "China", lat: 22.3080, lon: 113.9185 },
  { iata: "NRT", name: "Narita", city: "Tokyo", country: "Japan", lat: 35.7720, lon: 140.3929 },
  { iata: "HND", name: "Haneda", city: "Tokyo", country: "Japan", lat: 35.5494, lon: 139.7798 },
  { iata: "KIX", name: "Kansai", city: "Osaka", country: "Japan", lat: 34.4320, lon: 135.2304 },
  { iata: "ICN", name: "Incheon", city: "Seoul", country: "South Korea", lat: 37.4602, lon: 126.4407 },
  { iata: "BKK", name: "Suvarnabhumi", city: "Bangkok", country: "Thailand", lat: 13.6900, lon: 100.7501 },
  { iata: "KUL", name: "Kuala Lumpur Intl", city: "Kuala Lumpur", country: "Malaysia", lat: 2.7456, lon: 101.7099 },
  { iata: "TPE", name: "Taoyuan Intl", city: "Taipei", country: "Taiwan", lat: 25.0797, lon: 121.2342 },
  { iata: "MNL", name: "Ninoy Aquino", city: "Manila", country: "Philippines", lat: 14.5086, lon: 121.0197 },
  { iata: "DEL", name: "Indira Gandhi", city: "Delhi", country: "India", lat: 28.5562, lon: 77.1000 },
  { iata: "BOM", name: "Chhatrapati Shivaji", city: "Mumbai", country: "India", lat: 19.0896, lon: 72.8656 },
  { iata: "PEK", name: "Beijing Capital", city: "Beijing", country: "China", lat: 40.0799, lon: 116.6031 },
  { iata: "PVG", name: "Pudong", city: "Shanghai", country: "China", lat: 31.1443, lon: 121.8083 },
  // --- Oceania ---
  { iata: "SYD", name: "Kingsford Smith", city: "Sydney", country: "Australia", lat: -33.9461, lon: 151.1772 },
  { iata: "MEL", name: "Tullamarine", city: "Melbourne", country: "Australia", lat: -37.6690, lon: 144.8410 },
  { iata: "BNE", name: "Brisbane", city: "Brisbane", country: "Australia", lat: -27.3842, lon: 153.1175 },
  { iata: "AKL", name: "Auckland", city: "Auckland", country: "New Zealand", lat: -37.0082, lon: 174.7850 },
  // --- Latin America ---
  { iata: "GRU", name: "Guarulhos", city: "Sao Paulo", country: "Brazil", lat: -23.4356, lon: -46.4731 },
  { iata: "GIG", name: "Galeao", city: "Rio de Janeiro", country: "Brazil", lat: -22.8100, lon: -43.2505 },
  { iata: "EZE", name: "Ezeiza", city: "Buenos Aires", country: "Argentina", lat: -34.8222, lon: -58.5358 },
  { iata: "MEX", name: "Benito Juarez", city: "Mexico City", country: "Mexico", lat: 19.4363, lon: -99.0721 },
  { iata: "CUN", name: "Cancun Intl", city: "Cancun", country: "Mexico", lat: 21.0365, lon: -86.8771 },
  { iata: "GDL", name: "Guadalajara Intl", city: "Guadalajara", country: "Mexico", lat: 20.5218, lon: -103.3113 },
  { iata: "SJO", name: "Juan Santamaria", city: "San Jose", country: "Costa Rica", lat: 9.9939, lon: -84.2088 },
  { iata: "PTY", name: "Tocumen Intl", city: "Panama City", country: "Panama", lat: 9.0714, lon: -79.3835 },
  { iata: "BOG", name: "El Dorado", city: "Bogota", country: "Colombia", lat: 4.7016, lon: -74.1469 },
  { iata: "SCL", name: "Arturo Merino Benitez", city: "Santiago", country: "Chile", lat: -33.3930, lon: -70.7858 },
  { iata: "LIM", name: "Jorge Chavez", city: "Lima", country: "Peru", lat: -12.0219, lon: -77.1143 },
  { iata: "MDE", name: "Jose Maria Cordova", city: "Medellin", country: "Colombia", lat: 6.1645, lon: -75.4231 },
  // --- Caribbean ---
  { iata: "SJU", name: "Luis Munoz Marin", city: "San Juan", country: "Puerto Rico", lat: 18.4394, lon: -66.0018 },
  { iata: "NAS", name: "Lynden Pindling", city: "Nassau", country: "Bahamas", lat: 25.0390, lon: -77.4662 },
  { iata: "MBJ", name: "Sangster Intl", city: "Montego Bay", country: "Jamaica", lat: 18.5037, lon: -77.9134 },
  { iata: "PUJ", name: "Punta Cana Intl", city: "Punta Cana", country: "Dominican Republic", lat: 18.5674, lon: -68.3634 },
  { iata: "SDQ", name: "Las Americas", city: "Santo Domingo", country: "Dominican Republic", lat: 18.4297, lon: -69.6689 },
  { iata: "STT", name: "Cyril E. King", city: "St. Thomas", country: "US Virgin Islands", lat: 18.3373, lon: -64.9734 },
  { iata: "AUA", name: "Queen Beatrix", city: "Aruba", country: "Aruba", lat: 12.5014, lon: -70.0152 },
  // --- Africa ---
  { iata: "JNB", name: "O.R. Tambo", city: "Johannesburg", country: "South Africa", lat: -26.1392, lon: 28.2460 },
  { iata: "CPT", name: "Cape Town Intl", city: "Cape Town", country: "South Africa", lat: -33.9649, lon: 18.6017 },
  { iata: "CAI", name: "Cairo Intl", city: "Cairo", country: "Egypt", lat: 30.1219, lon: 31.4056 },
  { iata: "CMN", name: "Mohammed V", city: "Casablanca", country: "Morocco", lat: 33.3675, lon: -7.5898 },
  { iata: "NBO", name: "Jomo Kenyatta", city: "Nairobi", country: "Kenya", lat: -1.3192, lon: 36.9278 },
  { iata: "ADD", name: "Bole Intl", city: "Addis Ababa", country: "Ethiopia", lat: 8.9779, lon: 38.7993 },
];

/**
 * Haversine distance in km between two lat/lon points.
 */
export function haversineDistanceKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Sort airports by distance from a given lat/lon (closest first).
 */
export function sortAirportsByDistance(
  airports: AirportOption[],
  userLat: number,
  userLon: number,
): AirportOption[] {
  return [...airports].sort((a, b) => {
    const distA = haversineDistanceKm(userLat, userLon, a.lat, a.lon);
    const distB = haversineDistanceKm(userLat, userLon, b.lat, b.lon);
    return distA - distB;
  });
}

export function airportLabel(iata: string): string {
  const a = HOME_AIRPORTS.find((x) => x.iata === iata);
  return a ? `${a.iata} -- ${a.city}` : iata;
}
