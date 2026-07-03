import type {
  Incident,
  Severity,
  HazardType,
  Source,
  AlertEntry,
  WatchlistLocation,
  BriefingItem,
  PriorityRegion,
  IntelligenceStreamEntry,
} from '../types';

// ─────────────────────────────────────────────────────────────
// PROTOTYPE FIXTURE — Mock Intelligence Data
// All data below is fabricated for visual demonstration only.
// It is NOT live, verified, or an official emergency warning.
// ─────────────────────────────────────────────────────────────

export const PROTOTYPE_LABEL = 'Prototype Fixture';
export const PROTOTYPE_DISCLAIMER =
  'Mock Intelligence Data — not live, not verified, not an official emergency warning.';

export const mockSources: Source[] = [
  {
    id: 'usgs',
    name: 'U.S. Geological Survey',
    shortName: 'USGS',
    description:
      'Simulated earthquake monitoring data for interface demonstration.',
    coverage: 'Global seismic events, magnitude 2.5+',
    lastSync: '2026-07-02T06:42:00Z',
    dataUseRole: 'Simulated seismic event records',
    health: 'operational',
    integrityStatus: 'verified',
  },
  {
    id: 'eonet',
    name: 'NASA Earth Observatory Natural Event Tracker',
    shortName: 'NASA EONET',
    description:
      'Simulated catalog of natural events for interface demonstration.',
    coverage: 'Global natural events, multi-category',
    lastSync: '2026-07-02T06:38:00Z',
    dataUseRole: 'Simulated natural event records',
    health: 'operational',
    integrityStatus: 'verified',
  },
  {
    id: 'gdacs',
    name: 'Global Disaster Alert and Coordination System',
    shortName: 'GDACS',
    description:
      'Simulated disaster alert data for interface demonstration.',
    coverage: 'Global disaster alerts, humanitarian impact',
    lastSync: '2026-07-02T06:30:00Z',
    dataUseRole: 'Simulated impact assessment',
    health: 'degraded',
    integrityStatus: 'pending',
  },
  {
    id: 'openmeteo',
    name: 'Open-Meteo Weather API',
    shortName: 'Open-Meteo',
    description:
      'Simulated weather forecast data for interface demonstration.',
    coverage: 'Global weather forecasts, severe warnings',
    lastSync: '2026-07-02T06:45:00Z',
    dataUseRole: 'Simulated weather forecast context',
    health: 'operational',
    integrityStatus: 'forecast',
  },
];

export const mockIncidents: Incident[] = [
  {
    id: 'inc-001',
    title: 'M6.4 Earthquake — South Pacific',
    hazardType: 'earthquake',
    severity: 'high',
    status: 'active',
    summary:
      'A magnitude 6.4 earthquake was recorded in the South Pacific basin at a shallow depth of 12 km. Impact context is not represented in this prototype.',
    location: 'South Pacific Ocean, north of Fiji',
    coordinates: { lat: -17.8, lng: -178.4 },
    source: 'USGS',
    sourceId: 'usgs',
    reportedAt: '2026-07-02T04:12:00Z',
    updatedAt: '2026-07-02T06:20:00Z',
    integrity: 'verified',
    mapX: 82,
    mapY: 62,
    timeline: [
      {
        id: 'tl-001-1',
        timestamp: '2026-07-02T04:12:00Z',
        title: 'Initial seismic detection',
        description:
          'USGS recorded a magnitude 6.4 event at 04:12 UTC. Depth estimated at 12 km.',
        integrity: 'verified',
        source: 'USGS',
      },
      {
        id: 'tl-001-2',
        timestamp: '2026-07-02T04:28:00Z',
        title: 'Simulated tsunami advisory state',
        description:
          'A simulated tsunami advisory state is represented for nearby island coastlines.',
        integrity: 'verified',
        source: 'GDACS',
      },
      {
        id: 'tl-001-3',
        timestamp: '2026-07-02T05:45:00Z',
        title: 'Aftershock cluster detected',
        description:
          'A cluster of three aftershocks (M4.1–M5.0) recorded within 90 minutes of the main event.',
        integrity: 'verified',
        source: 'USGS',
      },
      {
        id: 'tl-001-4',
        timestamp: '2026-07-02T06:20:00Z',
        title: 'Impact assessment pending',
        description:
          'Awaiting ground-truth damage reports from island monitoring stations.',
        integrity: 'pending',
        source: 'GDACS',
      },
    ],
    evidence: [
      {
        id: 'ev-001-1',
        title: 'USGS Event Page — M6.4 South Pacific',
        source: 'USGS',
        url: '#prototype-usgs-event-001',
        timestamp: '2026-07-02T04:12:00Z',
        integrity: 'verified',
        summary:
          'Simulated seismic event record including magnitude, depth, and moment tensor solution.',
      },
      {
        id: 'ev-001-2',
        title: 'GDACS Alert Bulletin — Earthquake',
        source: 'GDACS',
        url: '#prototype-gdacs-001',
        timestamp: '2026-07-02T04:30:00Z',
        integrity: 'pending',
        summary:
          'Simulated alert bulletin with illustrative population exposure estimates.',
      },
    ],
    context: [
      {
        id: 'ctx-001-1',
        label: 'Regional Wind Forecast',
        value: '15–20 kt ESE',
        integrity: 'forecast',
        note: 'Open-Meteo 72-hour regional forecast.',
      },
      {
        id: 'ctx-001-2',
        label: 'Air Quality Index',
        value: 'Unavailable',
        integrity: 'unavailable',
        note: 'No AQI monitoring stations within range of the epicentre.',
      },
    ],
    relatedIds: ['inc-005'],
  },
  {
    id: 'inc-002',
    title: 'Wildfire Complex — Western Canada',
    hazardType: 'wildfire',
    severity: 'critical',
    status: 'active',
    summary:
      'A wildfire complex across western Canada is represented as expanding in this illustrative fixture. Impact context is not represented in this prototype.',
    location: 'British Columbia, Canada',
    coordinates: { lat: 52.1, lng: -121.5 },
    source: 'NASA EONET',
    sourceId: 'eonet',
    reportedAt: '2026-07-01T18:30:00Z',
    updatedAt: '2026-07-02T06:10:00Z',
    integrity: 'verified',
    mapX: 16,
    mapY: 28,
    timeline: [
      {
        id: 'tl-002-1',
        timestamp: '2026-07-01T18:30:00Z',
        title: 'Thermal anomaly detected',
        description:
          'NASA EONET identified a thermal anomaly via MODIS satellite imagery.',
        integrity: 'verified',
        source: 'NASA EONET',
      },
      {
        id: 'tl-002-2',
        timestamp: '2026-07-01T22:15:00Z',
        title: 'Complex expands to 8,000 ha',
        description:
          'Multiple fire fronts merged into a single complex in this illustrative fixture.',
        integrity: 'verified',
        source: 'NASA EONET',
      },
      {
        id: 'tl-002-3',
        timestamp: '2026-07-02T03:40:00Z',
        title: 'Simulated air quality state',
        description:
          'A simulated smoke plume tracking state extends the advisory zone to 200 km downwind in this fixture.',
        integrity: 'forecast',
        source: 'Open-Meteo',
      },
      {
        id: 'tl-002-4',
        timestamp: '2026-07-02T06:10:00Z',
        title: 'Containment at 12%',
        description:
          'Simulated containment at 12% is represented. Wind shift expected in 24 hours in this fixture.',
        integrity: 'pending',
        source: 'GDACS',
      },
    ],
    evidence: [
      {
        id: 'ev-002-1',
        title: 'NASA EONET — Wildfire Event',
        source: 'NASA EONET',
        url: '#prototype-eonet-002',
        timestamp: '2026-07-01T18:30:00Z',
        integrity: 'verified',
        summary:
          'Satellite-derived thermal anomaly detection with bounding box coordinates.',
      },
      {
        id: 'ev-002-2',
        title: 'Open-Meteo Smoke Dispersion Forecast',
        source: 'Open-Meteo',
        url: '#prototype-openmeteo-002',
        timestamp: '2026-07-02T03:40:00Z',
        integrity: 'forecast',
        summary: '72-hour smoke plume dispersion model output.',
      },
    ],
    context: [
      {
        id: 'ctx-002-1',
        label: 'Wind Speed & Direction',
        value: '22 kt WSW, shifting NW',
        integrity: 'forecast',
        note: 'Wind shift expected to aid containment within 24 hours.',
      },
      {
        id: 'ctx-002-2',
        label: 'Air Quality Index',
        value: 'AQI 187 (Unhealthy)',
        integrity: 'forecast',
        note: 'Illustrative air quality state for downwind regions.',
      },
    ],
    relatedIds: ['inc-006'],
  },
  {
    id: 'inc-003',
    title: 'Cyclone Watch — Bay of Bengal',
    hazardType: 'cyclone',
    severity: 'high',
    status: 'monitoring',
    summary:
      'A developing tropical system in the Bay of Bengal is projected to intensify in this illustrative fixture. Impact context is not represented in this prototype.',
    location: 'Bay of Bengal, east of India',
    coordinates: { lat: 15.2, lng: 88.7 },
    source: 'GDACS',
    sourceId: 'gdacs',
    reportedAt: '2026-07-01T12:00:00Z',
    updatedAt: '2026-07-02T05:50:00Z',
    integrity: 'forecast',
    mapX: 68,
    mapY: 48,
    timeline: [
      {
        id: 'tl-003-1',
        timestamp: '2026-07-01T12:00:00Z',
        title: 'Tropical disturbance identified',
        description:
          'A low-pressure system was classified as a tropical disturbance with organised convection.',
        integrity: 'forecast',
        source: 'GDACS',
      },
      {
        id: 'tl-003-2',
        timestamp: '2026-07-02T00:30:00Z',
        title: 'System upgraded to depression',
        description:
          'Sustained winds reached 30 kt. Track models converge on a west-northwest path.',
        integrity: 'forecast',
        source: 'Open-Meteo',
      },
      {
        id: 'tl-003-3',
        timestamp: '2026-07-02T05:50:00Z',
        title: 'Landfall probability updated',
        description:
          'Ensemble models place 60% probability of landfall within 72 hours along the delta coast.',
        integrity: 'forecast',
        source: 'Open-Meteo',
      },
    ],
    evidence: [
      {
        id: 'ev-003-1',
        title: 'GDACS Tropical Storm Alert',
        source: 'GDACS',
        url: '#prototype-gdacs-003',
        timestamp: '2026-07-01T12:00:00Z',
        integrity: 'forecast',
        summary: 'Preliminary storm track and intensity projection.',
      },
      {
        id: 'ev-003-2',
        title: 'Open-Meteo Ensemble Forecast',
        source: 'Open-Meteo',
        url: '#prototype-openmeteo-003',
        timestamp: '2026-07-02T05:50:00Z',
        integrity: 'forecast',
        summary: '50-member ensemble track and intensity forecast.',
      },
    ],
    context: [
      {
        id: 'ctx-003-1',
        label: 'Sea Surface Temperature',
        value: '29.4°C',
        integrity: 'forecast',
        note: 'Above threshold for rapid intensification.',
      },
      {
        id: 'ctx-003-2',
        label: 'Storm Surge Model',
        value: '1.5–2.5 m projected',
        integrity: 'forecast',
        note: 'Coastal inundation risk for low-lying delta areas.',
      },
    ],
    relatedIds: ['inc-004'],
  },
  {
    id: 'inc-004',
    title: 'Flood Alert — Central Europe',
    hazardType: 'flood',
    severity: 'elevated',
    status: 'active',
    summary:
      'Sustained heavy rainfall across central European river basins is represented as pushing water levels above flood stage in this illustrative fixture. Impact context is not represented in this prototype.',
    location: 'Danube Basin, Central Europe',
    coordinates: { lat: 48.3, lng: 16.4 },
    source: 'GDACS',
    sourceId: 'gdacs',
    reportedAt: '2026-07-01T20:00:00Z',
    updatedAt: '2026-07-02T06:00:00Z',
    integrity: 'verified',
    mapX: 52,
    mapY: 32,
    timeline: [
      {
        id: 'tl-004-1',
        timestamp: '2026-07-01T20:00:00Z',
        title: 'River gauge exceeds flood stage',
        description:
          'Multiple gauges along the Danube basin exceeded warning thresholds.',
        integrity: 'verified',
        source: 'GDACS',
      },
      {
        id: 'tl-004-2',
        timestamp: '2026-07-02T02:15:00Z',
        title: 'Simulated evacuation state',
        description:
          'A simulated precautionary evacuation state is represented for three riverside communities in this fixture.',
        integrity: 'verified',
        source: 'GDACS',
      },
      {
        id: 'tl-004-3',
        timestamp: '2026-07-02T06:00:00Z',
        title: 'Crest expected within 36 hours',
        description:
          'Hydrological models project the river crest to arrive within 36 hours.',
        integrity: 'forecast',
        source: 'Open-Meteo',
      },
    ],
    evidence: [
      {
        id: 'ev-004-1',
        title: 'GDACS Flood Alert Bulletin',
        source: 'GDACS',
        url: '#prototype-gdacs-004',
        timestamp: '2026-07-01T20:00:00Z',
        integrity: 'verified',
        summary: 'Simulated flood alert with illustrative population estimates.',
      },
    ],
    context: [
      {
        id: 'ctx-004-1',
        label: '72-hour Precipitation Forecast',
        value: '40–70 mm additional',
        integrity: 'forecast',
        note: 'Sustained rainfall expected to maintain elevated river levels.',
      },
      {
        id: 'ctx-004-2',
        label: 'Soil Saturation Index',
        value: '92% (Saturated)',
        integrity: 'forecast',
        note: 'Minimal absorption capacity remaining.',
      },
    ],
    relatedIds: ['inc-003'],
  },
  {
    id: 'inc-005',
    title: 'Volcanic Activity — Indonesia',
    hazardType: 'volcano',
    severity: 'elevated',
    status: 'monitoring',
    summary:
      'Increased seismic tremor and ash emissions are represented at an active Indonesian stratovolcano in this illustrative fixture. Impact context is not represented in this prototype.',
    location: 'Sunda Arc, Indonesia',
    coordinates: { lat: -7.9, lng: 112.9 },
    source: 'NASA EONET',
    sourceId: 'eonet',
    reportedAt: '2026-07-01T15:00:00Z',
    updatedAt: '2026-07-02T05:30:00Z',
    integrity: 'verified',
    mapX: 76,
    mapY: 58,
    timeline: [
      {
        id: 'tl-005-1',
        timestamp: '2026-07-01T15:00:00Z',
        title: 'Ash plume detected via satellite',
        description:
          'NASA EONET detected an ash plume reaching approximately 4,500 m altitude.',
        integrity: 'verified',
        source: 'NASA EONET',
      },
      {
        id: 'tl-005-2',
        timestamp: '2026-07-02T05:30:00Z',
        title: 'Simulated exclusion zone state',
        description:
          'A simulated 3 km exclusion zone state is represented around the summit in this fixture.',
        integrity: 'verified',
        source: 'NASA EONET',
      },
    ],
    evidence: [
      {
        id: 'ev-005-1',
        title: 'NASA EONET — Volcanic Event',
        source: 'NASA EONET',
        url: '#prototype-eonet-005',
        timestamp: '2026-07-01T15:00:00Z',
        integrity: 'verified',
        summary: 'Satellite-observed volcanic activity with plume altitude estimate.',
      },
    ],
    context: [
      {
        id: 'ctx-005-1',
        label: 'Ash Dispersion Forecast',
        value: 'Drifting WSW at 8 kt',
        integrity: 'forecast',
        note: 'Illustrative ash dispersion state for flight corridors.',
      },
      {
        id: 'ctx-005-2',
        label: 'Ground SO₂ Monitoring',
        value: 'Unavailable',
        integrity: 'unavailable',
        note: 'Nearest ground station offline for maintenance.',
      },
    ],
    relatedIds: ['inc-001'],
  },
  {
    id: 'inc-006',
    title: 'Severe Weather — North Atlantic Storm',
    hazardType: 'severe-weather',
    severity: 'advisory',
    status: 'monitoring',
    summary:
      'A deep low-pressure system in the North Atlantic is represented as producing sustained gale-force winds in this illustrative fixture. Impact context is not represented in this prototype.',
    location: 'North Atlantic Ocean',
    coordinates: { lat: 48.7, lng: -30.2 },
    source: 'Open-Meteo',
    sourceId: 'openmeteo',
    reportedAt: '2026-07-02T02:00:00Z',
    updatedAt: '2026-07-02T06:15:00Z',
    integrity: 'forecast',
    mapX: 40,
    mapY: 26,
    timeline: [
      {
        id: 'tl-006-1',
        timestamp: '2026-07-02T02:00:00Z',
        title: 'Storm system deepening',
        description:
          'Central pressure dropping below 980 hPa with sustained winds near 45 kt.',
        integrity: 'forecast',
        source: 'Open-Meteo',
      },
      {
        id: 'tl-006-2',
        timestamp: '2026-07-02T06:15:00Z',
        title: 'Track models updated',
        description:
          'System projected to track north-eastward, avoiding major landmasses.',
        integrity: 'forecast',
        source: 'Open-Meteo',
      },
    ],
    evidence: [
      {
        id: 'ev-006-1',
        title: 'Open-Meteo Severe Weather Warning',
        source: 'Open-Meteo',
        url: '#prototype-openmeteo-006',
        timestamp: '2026-07-02T02:00:00Z',
        integrity: 'forecast',
        summary: 'Gale warning with wind speed and significant wave height forecasts.',
      },
    ],
    context: [
      {
        id: 'ctx-006-1',
        label: 'Significant Wave Height',
        value: '6.5–8.0 m',
        integrity: 'forecast',
        note: 'Hazardous sea state for maritime traffic.',
      },
      {
        id: 'ctx-006-2',
        label: 'Wind Gust Forecast',
        value: 'Up to 60 kt',
        integrity: 'forecast',
        note: 'Peak gusts expected along the storm track.',
      },
    ],
    relatedIds: ['inc-002'],
  },
];

export const mockAlerts: AlertEntry[] = [
  {
    id: 'alert-001',
    incidentId: 'inc-002',
    title: 'Critical: Wildfire Complex within 500 km of watched location',
    severity: 'critical',
    hazardType: 'wildfire',
    message:
      'A critical wildfire complex in Western Canada is represented as expanding in this illustrative fixture. Impact context is not represented in this prototype.',
    timestamp: '2026-07-02T06:10:00Z',
    read: false,
    rule: 'Critical severity within 500 km',
    location: 'British Columbia, Canada',
  },
  {
    id: 'alert-002',
    incidentId: 'inc-001',
    title: 'High: M6.4 Earthquake matches your Earthquake alert rule',
    severity: 'high',
    hazardType: 'earthquake',
    message:
      'A magnitude 6.4 earthquake was detected in the South Pacific. This matches your Earthquake alert rule (M5.0+).',
    timestamp: '2026-07-02T04:12:00Z',
    read: false,
    rule: 'Earthquake alert rule (M5.0+)',
    location: 'South Pacific Ocean',
  },
  {
    id: 'alert-003',
    incidentId: 'inc-003',
    title: 'High: Cyclone developing near watched location',
    severity: 'high',
    hazardType: 'cyclone',
    message:
      'A developing tropical system in the Bay of Bengal is projected to intensify. Coastal regions near your watched location may be affected.',
    timestamp: '2026-07-02T05:50:00Z',
    read: false,
    rule: 'Cyclone alert rule (within 800 km)',
    location: 'Bay of Bengal',
  },
  {
    id: 'alert-004',
    incidentId: 'inc-004',
    title: 'Elevated: Flood alert within 500 km of watched location',
    severity: 'elevated',
    hazardType: 'flood',
    message:
      'River gauges in central Europe are represented as exceeding flood stage in this illustrative fixture. Impact context is not represented in this prototype.',
    timestamp: '2026-07-02T02:15:00Z',
    read: true,
    rule: 'Flood alert rule (within 500 km)',
    location: 'Danube Basin, Central Europe',
  },
  {
    id: 'alert-005',
    incidentId: 'inc-005',
    title: 'Elevated: Volcanic activity in monitored region',
    severity: 'elevated',
    hazardType: 'volcano',
    message:
      'Increased seismic tremor and ash emissions are represented at an Indonesian stratovolcano in this illustrative fixture. Impact context is not represented in this prototype.',
    timestamp: '2026-07-02T05:30:00Z',
    read: true,
    rule: 'Volcano alert rule (monitored regions)',
    location: 'Sunda Arc, Indonesia',
  },
  {
    id: 'alert-006',
    incidentId: 'inc-006',
    title: 'Advisory: Severe weather in North Atlantic',
    severity: 'advisory',
    hazardType: 'severe-weather',
    message:
      'A deep low-pressure system is represented as producing gale-force winds in the North Atlantic in this illustrative fixture. Impact context is not represented in this prototype.',
    timestamp: '2026-07-02T06:15:00Z',
    read: true,
    rule: 'Severe weather advisory rule',
    location: 'North Atlantic Ocean',
  },
];

export const mockWatchlist: WatchlistLocation[] = [
  {
    id: 'wl-001',
    name: 'Bengaluru',
    country: 'India',
    coordinates: { lat: 12.97, lng: 77.59 },
    alertRules: ['earthquake', 'flood', 'cyclone'],
    addedAt: '2026-06-15T10:00:00Z',
  },
  {
    id: 'wl-002',
    name: 'Kuala Lumpur',
    country: 'Malaysia',
    coordinates: { lat: 3.14, lng: 101.69 },
    alertRules: ['earthquake', 'flood', 'severe-weather'],
    addedAt: '2026-06-20T14:30:00Z',
  },
  {
    id: 'wl-003',
    name: 'Kochi',
    country: 'India',
    coordinates: { lat: 9.93, lng: 76.27 },
    alertRules: ['flood', 'cyclone', 'severe-weather'],
    addedAt: '2026-06-25T09:15:00Z',
  },
];

export const mockPriorityRegions: PriorityRegion[] = [
  {
    id: 'pr-001',
    name: 'South Pacific Basin',
    incidentCount: 1,
    topSeverity: 'high',
    summary: 'Active seismic zone with recent M6.4 event and aftershock cluster.',
  },
  {
    id: 'pr-002',
    name: 'Western Canada',
    incidentCount: 1,
    topSeverity: 'critical',
    summary: 'Critical wildfire complex represented as expanding in this fixture.',
  },
  {
    id: 'pr-003',
    name: 'Bay of Bengal',
    incidentCount: 1,
    topSeverity: 'high',
    summary: 'Developing cyclone with illustrative landfall probability in this fixture.',
  },
  {
    id: 'pr-004',
    name: 'Central Europe',
    incidentCount: 1,
    topSeverity: 'elevated',
    summary: 'River basin flooding with crest expected within 36 hours.',
  },
];

export const mockIntelligenceStream: IntelligenceStreamEntry[] = [
  {
    id: 'is-001',
    incidentId: 'inc-002',
    timestamp: '2026-07-02T06:10:00Z',
    title: 'Wildfire containment updated to 12%',
    severity: 'critical',
    hazardType: 'wildfire',
  },
  {
    id: 'is-002',
    incidentId: 'inc-006',
    timestamp: '2026-07-02T06:15:00Z',
    title: 'North Atlantic storm track models updated',
    severity: 'advisory',
    hazardType: 'severe-weather',
  },
  {
    id: 'is-003',
    incidentId: 'inc-001',
    timestamp: '2026-07-02T06:20:00Z',
    title: 'Impact assessment pending for South Pacific earthquake',
    severity: 'high',
    hazardType: 'earthquake',
  },
  {
    id: 'is-004',
    incidentId: 'inc-004',
    timestamp: '2026-07-02T06:00:00Z',
    title: 'Danube basin river crest expected within 36 hours',
    severity: 'elevated',
    hazardType: 'flood',
  },
  {
    id: 'is-005',
    incidentId: 'inc-003',
    timestamp: '2026-07-02T05:50:00Z',
    title: 'Cyclone landfall probability updated to 60%',
    severity: 'high',
    hazardType: 'cyclone',
  },
  {
    id: 'is-006',
    incidentId: 'inc-005',
    timestamp: '2026-07-02T05:30:00Z',
    title: 'Volcanic ash dispersion forecast updated',
    severity: 'elevated',
    hazardType: 'volcano',
  },
];

export const mockBriefingItems: BriefingItem[] = [
  {
    id: 'bf-001',
    section: 'overnight-changes',
    title: 'Wildfire complex escalated to critical severity',
    detail:
      'The Western Canada wildfire complex is represented as expanding overnight from 8,000 to 18,000 hectares in this fixture. Simulated containment is at 12% with a wind shift expected in 24 hours.',
    integrity: 'verified',
    relatedIncidentId: 'inc-002',
  },
  {
    id: 'bf-002',
    section: 'overnight-changes',
    title: 'M6.4 earthquake detected in South Pacific',
    detail:
      'A shallow magnitude 6.4 earthquake is represented at 04:12 UTC in this fixture. A simulated tsunami advisory state is represented and has since been lifted.',
    integrity: 'verified',
    relatedIncidentId: 'inc-001',
  },
  {
    id: 'bf-003',
    section: 'watchlist-exposure',
    title: 'Bengaluru — Cyclone watch within 1,800 km',
    detail:
      'A developing cyclone in the Bay of Bengal is within the monitoring radius of your Bengaluru watchlist. Track models place landfall probability at 60% within 72 hours.',
    integrity: 'forecast',
    relatedIncidentId: 'inc-003',
  },
  {
    id: 'bf-004',
    section: 'watchlist-exposure',
    title: 'Kochi — Cyclone track may influence monsoon conditions',
    detail:
      'The Bay of Bengal system may intensify monsoon flow toward the Kerala coast. No direct threat to Kochi at this time, but conditions are being monitored.',
    integrity: 'forecast',
    relatedIncidentId: 'inc-003',
  },
  {
    id: 'bf-005',
    section: 'priority-incidents',
    title: 'Critical: Wildfire Complex — Western Canada',
    detail:
      'Highest priority incident in this fixture. Simulated evacuation and air quality states are represented. Impact context is not represented in this prototype.',
    integrity: 'verified',
    relatedIncidentId: 'inc-002',
  },
  {
    id: 'bf-006',
    section: 'priority-incidents',
    title: 'High: Cyclone Watch — Bay of Bengal',
    detail:
      'Developing system with illustrative landfall probability. Simulated coastal preparation state is represented in this fixture.',
    integrity: 'forecast',
    relatedIncidentId: 'inc-003',
  },
  {
    id: 'bf-007',
    section: 'weather-context',
    title: 'Monsoon conditions intensifying across South Asia',
    detail:
      'The developing Bay of Bengal system is expected to enhance monsoon flow across peninsular India over the next 48–72 hours.',
    integrity: 'forecast',
  },
  {
    id: 'bf-008',
    section: 'weather-context',
    title: 'North Atlantic storm tracking north-eastward',
    detail:
      'A deep low-pressure system is tracking away from major landmasses but affecting transatlantic maritime routes.',
    integrity: 'forecast',
  },
  {
    id: 'bf-009',
    section: 'data-availability',
    title: 'GDACS ingestion experiencing degraded performance',
    detail:
      'The GDACS source feed is operating in a degraded state. Some impact assessments may be delayed. USGS and NASA EONET remain fully operational.',
    integrity: 'pending',
  },
  {
    id: 'bf-010',
    section: 'data-availability',
    title: 'Volcanic ground SO₂ monitoring unavailable',
    detail:
      'The nearest ground-based SO₂ monitoring station for the Indonesian volcanic event is offline for maintenance. Satellite-derived data remains available.',
    integrity: 'unavailable',
  },
];

// ── Helper lookups ──────────────────────────────────────────

export const severityOrder: Record<Severity, number> = {
  critical: 4,
  high: 3,
  elevated: 2,
  advisory: 1,
};

export const hazardTypeLabels: Record<HazardType, string> = {
  earthquake: 'Earthquake',
  wildfire: 'Wildfire',
  flood: 'Flood',
  cyclone: 'Cyclone',
  volcano: 'Volcano',
  'severe-weather': 'Severe Weather',
};

export function getIncidentById(id: string): Incident | undefined {
  return mockIncidents.find((i) => i.id === id);
}

export function getRelatedIncidents(incident: Incident): Incident[] {
  return incident.relatedIds
    .map((id) => getIncidentById(id))
    .filter((i): i is Incident => i !== undefined);
}
