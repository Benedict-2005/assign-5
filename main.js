const map = L.map('map', { minZoom: 3 }).setView([65, 26], 5);

// OpenStreetMap background
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Data containers
let migrationData = {};

async function fetchMigrationData() {
  const query = await fetch('migration_data_query.json').then(res => res.json());
  const response = await fetch('https://pxdata.stat.fi:443/PxWeb/api/v1/fi/StatFin/muutl/statfin_muutl_pxt_11a2.px', {
    method: 'POST',
    body: JSON.stringify(query),
    headers: { 'Content-Type': 'application/json' }
  });

  const data = await response.json();
  const areas = data.dimension.Alue.category.index;
  const values = data.value;

  let idx = 0;
  for (const code in areas) {
    const pos = values[idx];
    const neg = values[idx + 1];
    migrationData[code] = { pos, neg };
    idx += 2;
  }
}
console.log('Migration data fetched:', migrationData); // Debug: Log the entire migration data object
async function initMap() {
  await fetchMigrationData();

  const geojson = await fetch('https://geo.stat.fi/geoserver/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=tilastointialueet:kunta4500k&outputFormat=json&srsName=EPSG:4326')
    .then(res => res.json());

  const geoLayer = L.geoJSON(geojson, {
    style: feature => {
      const code = feature.properties.kunta;
      const data = migrationData['KU' + code] || { pos: 0, neg: 1 }; // Default to 0, 1 if undefined
      const { pos, neg } = data;
      // console.log(`Municipality: ${code}, Pos: ${pos}, Neg: ${neg}`); // Debug data
      const hue = neg ? Math.min((pos / neg) ** 3 * 60, 120) : 0;
      return {
        weight: 2,
        color: `hsl(${hue}, 75%, 50%)`
      };
    },
    onEachFeature: (feature, layer) => {
      const name = feature.properties.nimi;
      const code = feature.properties.kunta;
      const data = migrationData['KU' + code] || { pos: 0, neg: 0 }; // Default to 0, 0 for popup
      const { pos, neg } = data;

      layer.bindTooltip(name);
      layer.on('click', () => {
        layer.bindPopup(`<b>${name}</b><br>Positive: ${pos}<br>Negative: ${neg}`).openPopup();
      });
    }
  }).addTo(map);

  map.fitBounds(geoLayer.getBounds());
}

initMap();