const apiKey = "YOUR_API_KEY";
let map = L.map("map").setView([36.848812876428774, 30.620393157005314], 15);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

let points = [];
let markers = [];
let routeLayer = null;

map.on("click", function (e) {
  const marker = L.marker(e.latlng)
    .addTo(map)
    .bindPopup(points.length === 0 ? "Start" : `Stop ${points.length}`)
    .openPopup();
  markers.push(marker);
  points.push([e.latlng.lng, e.latlng.lat]);
});

document.getElementById("routeBtn").onclick = async function () {
  if (points.length < 3) {
    alert("You must choose start, finish and at least one stop!");
    return;
  }
  if (routeLayer) map.removeLayer(routeLayer);

  // Separate the first and the last point, the stops in between
  const start = points[0];
  const end = points[points.length - 1];
  const waypointPoints = points.slice(1, -1);

  // Create Jobs
  const jobs = waypointPoints.map((loc, i) => ({
    id: i + 1,
    location: loc,
  }));
  const vehicle = {
    id: 1,
    start: start,
    end: end,
    profile: "driving-car",
  };

  // Optimisation request
  const optimizationRes = await fetch(
    "https://api.openrouteservice.org/optimization",
    {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jobs: jobs,
        vehicles: [vehicle],
      }),
    }
  );
  const optimizationData = await optimizationRes.json();

  if (!optimizationData.routes || optimizationData.routes.length === 0) {
    alert("Optimisation failed! Check the points and the API key.");
    return;
  }

  // Create ranking
  const steps = optimizationData.routes[0].steps;
  // Steps involving only job
  const orderedWaypoints = steps
    .filter((s) => s.hasOwnProperty("job"))
    .map((s) => {
      const job = jobs.find((j) => j.id === s.job);
      return { location: job.location, index: s.job };
    });

  // Start + optimised stops + end
  const orderedPoints = [
    start,
    ...orderedWaypoints.map((wp) => wp.location),
    end,
  ];

  // Show ranking to user
  let info = `Optimum Stop Sequence:\nStart\n`;
  orderedWaypoints.forEach((wp, idx) => {
    info += `Stop ${idx + 1}\n`;
  });
  info += "End";
  alert(info);

  // Directions API ile rotayı al
  const directionsRes = await fetch(
    "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
    {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        coordinates: orderedPoints,
      }),
    }
  );
  const directionsData = await directionsRes.json();

  routeLayer = L.geoJSON(directionsData, {
    style: { color: "blue", weight: 4 },
  }).addTo(map);
  map.fitBounds(routeLayer.getBounds());
};
