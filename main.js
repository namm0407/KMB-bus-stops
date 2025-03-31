let highlightedStop = null;  
let currentETAContainer = null;  
let map = null;
let markerLayer = null;
let userPositionLayer = null;

// Initialize the map
function initMap() {

    map = new ol.Map({
        target: 'map',
        layers: [
            new ol.layer.Tile({
                source: new ol.source.OSM()
            })
        ],
        view: new ol.View({
            center: ol.proj.fromLonLat([114.1694, 22.3193]), // Hong Kong coordinates
            zoom: 12
        })
    });
    
    markerLayer = new ol.layer.Vector({
        source: new ol.source.Vector()
    });
    map.addLayer(markerLayer);
    
    userPositionLayer = new ol.layer.Vector({
        source: new ol.source.Vector()
    });
    map.addLayer(userPositionLayer);
}

// Show the map with a specific bus stop
function showMapWithStop(stop, userPosition) {
    const mapContainer = document.getElementById('map-container');
    mapContainer.style.display = 'block';
    
    //midpoint 
    const stopCoords = ol.proj.fromLonLat([stop.long, stop.lat]);
    const userCoords = ol.proj.fromLonLat([userPosition.lon, userPosition.lat]);

    const midpoint = [
        (stopCoords[0] + userCoords[0]) / 2,
        (stopCoords[1] + userCoords[1]) / 2
    ];
    
    // Calculate distance between points in meters
    const distance = haversine(
        userPosition.lat, userPosition.lon,
        stop.lat, stop.long
    );
    
    // zoom level 
    let zoomLevel;
    if (distance < 100) { 
        zoomLevel = 18;
    } else if (distance < 200) { 
        zoomLevel = 17.5;
    } else if (distance < 300) { 
        zoomLevel = 17;
    } else if (distance < 400) { 
        zoomLevel = 16.5;
    } else if (distance < 500) { 
        zoomLevel = 16;
    } else { 
        zoomLevel = 15;
    }

    // Center map on the bus stop
    const view = map.getView();
    view.setCenter(midpoint);
    view.setZoom(zoomLevel);
    
    // Clear previous markers
    markerLayer.getSource().clear();
    userPositionLayer.getSource().clear();
    
    // Add bus stop marker with bus icon
    const busStopMarker = new ol.Feature({
        geometry: new ol.geom.Point(ol.proj.fromLonLat([stop.long, stop.lat]))
    });
    
    const busStopIcon = new ol.style.Style({
        image: new ol.style.Icon({
            anchor: [0.5, 1],
            src: 'bus-icon.ico', 
            scale: 1
        })
    });
    
    busStopMarker.setStyle(busStopIcon);
    markerLayer.getSource().addFeature(busStopMarker);
    
    // Add user position marker with map marker icon
    if (userPosition) {
        const userMarker = new ol.Feature({
            geometry: new ol.geom.Point(ol.proj.fromLonLat([userPosition.lon, userPosition.lat]))
        });
        
        const userMarkerIcon = new ol.style.Style({
            image: new ol.style.Icon({
                anchor: [0.5, 1],
                src: 'map-marker.ico', 
                scale: 1
            })
        });
        
        userMarker.setStyle(userMarkerIcon);
        userPositionLayer.getSource().addFeature(userMarker);
    }
}

// Close the map
function closeMap() {
    document.getElementById('map-container').style.display = 'none';
}

// Initialize the map when the page loads
document.addEventListener("DOMContentLoaded", function() {
    initMap();
    findNearbyBusStops();
});

// Fetch bus stops data
async function fetchBusStops() {
    const response = await fetch('https://data.etabus.gov.hk/v1/transport/kmb/stop'); 
    if (!response.ok) {
        throw new Error('The request is blocked');
    }
    
    return await response.json();
}

// Load bus stops
async function loadBusStops() {
    let stopList = sessionStorage.getItem('StopList');

    if (!stopList) {
        stopList = await fetchBusStops();
        sessionStorage.setItem('StopList', JSON.stringify(stopList));
    } else {
        stopList = JSON.parse(stopList);
    }

    return stopList.data;
}

// Fetch ETA for a specific stop
async function fetchStopETA(stopId) {
    try {
        const response = await fetch(`https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/${stopId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch ETA data');
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching ETA:', error);
        throw error; 
    }
}

// Haversine formula to calculate distance
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters 
    const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; 
}

function formatTime(isoString) {
    const date = new Date(isoString);
    const options = { hour: 'numeric', minute: 'numeric', hour12: true };
    return date.toLocaleString('en-US', options);
}

// Display ETAs on the page
function displayETAs(etaData, container) {
    container.innerHTML = ''; // Clear previous ETAs
    // Create elements directly in this stop's container
    const validETAs = etaData.data.filter(eta => eta.eta !== null);
    
    if (validETAs.length === 0) {
        container.textContent = 'No bus route information';
        return;
    }

    const routes = {};
    validETAs.forEach(eta => {
        const key = `${eta.route}_${eta.dir}`;
        if (!routes[key]) {
            routes[key] = {
                route: eta.route,
                dest_en: eta.dest_en,
                etas: []
            };
        }
        routes[key].etas.push(formatTime(eta.eta));
    });

    for (const key in routes) {
        const route = routes[key];
        
        const routeDiv = document.createElement('div');
        routeDiv.style.display = 'flex';
        routeDiv.style.flexDirection = 'column'; // Stack elements vertically
        routeDiv.style.marginTop = '10px';
        
        // Route number and destination line
        const routeLine = document.createElement('div');
        routeLine.style.display = 'flex';
        routeLine.style.gap = '50px';
        routeLine.style.alignItems = 'baseline';
        
        const routeSpan = document.createElement('span');
        routeSpan.textContent = route.route;
        routeSpan.style.fontWeight = 'bold';
        routeSpan.style.minWidth = '20px'; // Fixed width for alignment
        
        const destSpan = document.createElement('span');
        destSpan.textContent = route.dest_en.toLowerCase(); // Lowercase destination
        destSpan.style.flexGrow = '1';
        
        routeLine.appendChild(routeSpan);
        routeLine.appendChild(destSpan);
        
        // ETA line
        const etaLine = document.createElement('div');
        etaLine.style.display = 'flex';
        etaLine.style.gap = '10px';
        
        const etasSpan = document.createElement('span');
        etasSpan.textContent = 'ETA:';
        etasSpan.style.fontWeight = 'bold';
        
        const timeSpan = document.createElement('span');
        timeSpan.textContent = route.etas.join('    '); 
        timeSpan.style.color = 'blue';
        timeSpan.style.fontWeight = 'bold';
        
        etaLine.appendChild(etasSpan);
        etaLine.appendChild(timeSpan);
        
        routeDiv.appendChild(routeLine);
        routeDiv.appendChild(etaLine);
        
        container.appendChild(routeDiv);
    }
}

// Find nearby bus stops based on user's location
async function findNearbyBusStops() {
    closeMap();
    console.log("Finding nearby bus stops...");

    const messageElement = document.getElementById('message');
    const busStopListElement = document.getElementById('bus-stop-list');
    const radiusSelect = document.getElementById('radius');

    messageElement.textContent = '';

    if (!navigator.geolocation) {
        messageElement.textContent = 'Geolocation is not supported by this browser.';
        console.log("Geolocation not supported.");
        return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
        console.log("Geolocation acquired:", position);

        const lat = position.coords.latitude; 
        const lon = position.coords.longitude;
        const radius = parseInt(radiusSelect.value);

        console.log("Radius selected:", radius);

        if (isNaN(radius) || radius <= 0) {
            messageElement.textContent = 'Please enter a valid radius.';
            console.log("Invalid radius entered.");
            return;
        }

        const stopList = await loadBusStops();
        console.log("Bus stop list:", stopList);

        const nearbyStops = stopList.filter(stop => {
            const distance = haversine(lat, lon, stop.lat, stop.long);
            return distance <= radius;
        });

        busStopListElement.innerHTML = '';
        if (nearbyStops.length > 0) {
            nearbyStops.sort((a, b) => {
                return haversine(lat, lon, a.lat, a.long) - haversine(lat, lon, b.lat, b.long);
            });

            nearbyStops.forEach(stop => {
                const distance = haversine(lat, lon, stop.lat, stop.long).toFixed(0);
                const listItem = document.createElement('li');
                
                const stopInfoContainer = document.createElement('div');
                stopInfoContainer.classList.add('stop-info');
                
                const distanceSpan = document.createElement('span');
                // Create a span for the bold 'D'
                const boldD = document.createElement('span');
                boldD.textContent = 'D';
                boldD.style.fontWeight = 'bold';
                // Create a span for the rest of the word
                const remainingDistance = document.createElement('span');
                remainingDistance.textContent = `istance: ${distance}m `;
                // Combine them
                distanceSpan.appendChild(boldD);
                distanceSpan.appendChild(remainingDistance);  

                const stopSpan = document.createElement('span');
                stopSpan.className = 'stop-name';

                const boldS = document.createElement('span');
                boldS.className = 'first-letter';
                boldS.textContent = 'S';

                const remainingStop = document.createElement('span');
                remainingStop.textContent = 'top: ';

                const stopName = document.createElement('span');
                stopName.className = 'name';
                stopName.textContent = stop.name_en;

                stopSpan.appendChild(boldS);
                stopSpan.appendChild(remainingStop);
                stopSpan.appendChild(stopName);
                
                // Combine all parts
                stopSpan.appendChild(boldS);      
                stopSpan.appendChild(remainingStop); 
                stopSpan.appendChild(stopName); 
                                
                const etaContainer = document.createElement('div');
                etaContainer.classList.add('eta-container');
                etaContainer.style.display = 'none';
                
                stopInfoContainer.appendChild(distanceSpan);
                stopInfoContainer.appendChild(stopSpan);
                listItem.appendChild(stopInfoContainer);
                listItem.appendChild(etaContainer);
                busStopListElement.appendChild(listItem);
                

                // Then modify your stop click handler:
                stopSpan.addEventListener('click', async () => {
                    try {
                        const isShowing = etaContainer.style.display !== 'none';
                        if (isShowing) {
                            etaContainer.style.display = 'none';
                            stopInfoContainer.classList.remove('highlighted');
                            highlightedStop = null;
                            currentETAContainer = null;
                            closeMap();
                            return;
                        }
            
                        // Hide previous ETA container if exists
                        if (currentETAContainer && currentETAContainer !== etaContainer) {
                            currentETAContainer.style.display = 'none';
                        }
            
                        // Remove highlight from previous
                        if (highlightedStop) {
                            highlightedStop.classList.remove('highlighted');
                        }
                        
                        // Update references to current stop
                        stopInfoContainer.classList.add('highlighted');
                        highlightedStop = stopInfoContainer;
                        currentETAContainer = etaContainer;
                    
                        // Show loading state
                        etaContainer.style.display = 'block';
                        
                        // Scroll to show the selected stop
                        listItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        
                        const etaData = await fetchStopETA(stop.stop);
                        
                        // Clear and display ETAs
                        etaContainer.innerHTML = '';
                        
                        if (etaData?.data?.length > 0) {
                            displayETAs(etaData, etaContainer);
                            showMapWithStop(stop, { lat, lon });
                        } else {
                            etaContainer.textContent = 'No ETA information available';
                        }
                        
                    } catch (error) {
                        console.error("Error fetching ETA:", error);
                        etaContainer.textContent = 'Failed to load ETA data';
                        if (highlightedStop === stopInfoContainer) {
                            stopInfoContainer.classList.remove('highlighted');
                            highlightedStop = null;
                            currentETAContainer = null;
                        }
                    }
                });
            });
        } else {
            messageElement.textContent = 'Cannot locate nearby bus stops';
            console.log("No nearby bus stops found.");
        }
    }, (error) => {
        messageElement.textContent = 'Error getting location: ' + error.message;
        console.log("Geolocation error:", error);
    });
}

// Call findNearbyBusStops when the radius changes
document.getElementById('radius').addEventListener('change', findNearbyBusStops);
