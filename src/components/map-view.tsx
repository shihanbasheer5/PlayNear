"use client";

import * as React from "react";
import "leaflet/dist/leaflet.css";
import {
  MapPin,
  Navigation,
  Trophy,
  Compass,
  Locate,
  Loader2,
  List,
  X,
  Search,
  Maximize2,
  ChevronRight,
  Plus,
  Minus,
  ChevronDown,
  ChevronUp,
  MousePointerClick,
  Info,
  Layers,
  CircleDot,
} from "lucide-react";
import { Tournament } from "@/types/database.types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { formatDate, formatCurrency } from "@/lib/utils";
import {
  resolveTournamentCoordinates,
  calculateDistanceKm,
  formatDistance,
  searchPlaces,
  reverseGeocode,
  getStoredUserLocation,
  setStoredUserLocation,
  clearStoredUserLocation,
  PlaceSearchResult,
  Coordinates,
} from "@/lib/geo-utils";
import { getEffectiveTournamentStatus } from "@/lib/tournament-status";
import Link from "next/link";

interface MapViewProps {
  tournaments: Tournament[];
  selectedTournamentId?: string | null;
  onSelectTournament?: (id: string) => void;
}

export function MapView({
  tournaments,
  selectedTournamentId,
  onSelectTournament,
}: MapViewProps) {
  const mapContainerRef = React.useRef<HTMLDivElement>(null);
  const mapInstanceRef = React.useRef<any>(null);
  const markersLayerRef = React.useRef<any>(null);
  const radiusLayerRef = React.useRef<any>(null);
  const userMarkerRef = React.useRef<any>(null);

  const [activeTournament, setActiveTournament] = React.useState<Tournament | null>(
    tournaments.find((t) => t.id === selectedTournamentId) || null
  );
  const [isCardMinimized, setIsCardMinimized] = React.useState(false);

  // User location state — NO hardcoded city / NO mock data
  const [userLocation, setUserLocation] = React.useState<Coordinates | null>(null);
  const [userLocationName, setUserLocationName] = React.useState<string | null>(null);
  const [isLocating, setIsLocating] = React.useState(false);
  const [locationError, setLocationError] = React.useState<string | null>(null);
  const [locationNotice, setLocationNotice] = React.useState<string | null>(null);

  // Radius filter state (Preserve radius filters: 10 km, 25 km, 50 km)
  const [selectedRadius, setSelectedRadius] = React.useState<"all" | "10" | "25" | "50">("all");

  // Interactive Pin Placement Mode
  const [isPinMode, setIsPinMode] = React.useState(false);
  const isPinModeRef = React.useRef(false);
  isPinModeRef.current = isPinMode;

  // Place search bar
  const [placeQuery, setPlaceQuery] = React.useState("");
  const [placeSuggestions, setPlaceSuggestions] = React.useState<PlaceSearchResult[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = React.useState(false);
  const [showPlaceDropdown, setShowPlaceDropdown] = React.useState(false);

  // View & panel toggles
  const [showTournamentsPanel, setShowTournamentsPanel] = React.useState(false);
  const [tournamentSearch, setTournamentSearch] = React.useState("");
  const [selectedSportFilter, setSelectedSportFilter] = React.useState<string>("all");
  // Default to authentic Google Maps
  const [mapStyle, setMapStyle] = React.useState<"google" | "satellite" | "esri" | "osm">("google");

  // Load previously detected location from localStorage if present (client-side only)
  React.useEffect(() => {
    const stored = getStoredUserLocation();
    if (stored) {
      setUserLocation(stored.coords);
      setUserLocationName(stored.name);
    }
  }, []);

  // Geocoded tournaments cache with distance calculated dynamically
  const geocodedTournaments = React.useMemo(() => {
    return tournaments.map((t, idx) => {
      const coords = resolveTournamentCoordinates(t, idx);
      const distance = userLocation
        ? calculateDistanceKm(userLocation.lat, userLocation.lng, coords.lat, coords.lng)
        : null;
      return {
        ...t,
        status: getEffectiveTournamentStatus(t),
        computedCoords: coords,
        distanceFromUser: distance,
      };
    });
  }, [tournaments, userLocation]);

  // Apply distance radius filter (10 km, 25 km, 50 km)
  const radiusFilteredTournaments = React.useMemo(() => {
    if (selectedRadius === "all" || !userLocation) {
      return geocodedTournaments;
    }
    const maxDist = Number(selectedRadius);
    return geocodedTournaments.filter(
      (t) => t.distanceFromUser !== null && t.distanceFromUser <= maxDist
    );
  }, [geocodedTournaments, selectedRadius, userLocation]);

  // Filtered tournaments for the Browse drawer
  const browseTournaments = React.useMemo(() => {
    return radiusFilteredTournaments.filter((t) => {
      const matchSearch =
        !tournamentSearch.trim() ||
        (t.title || "").toLowerCase().includes(tournamentSearch.toLowerCase()) ||
        (t.venue_name || "").toLowerCase().includes(tournamentSearch.toLowerCase()) ||
        (t.venue_city || "").toLowerCase().includes(tournamentSearch.toLowerCase());

      const matchSport =
        selectedSportFilter === "all" ||
        t.sport?.slug === selectedSportFilter;

      return matchSearch && matchSport;
    });
  }, [radiusFilteredTournaments, tournamentSearch, selectedSportFilter]);

  // Sync active tournament from prop
  React.useEffect(() => {
    if (selectedTournamentId) {
      const found = tournaments.find((t) => t.id === selectedTournamentId);
      if (found) {
        setActiveTournament(found);
        setIsCardMinimized(false);
      }
    }
  }, [selectedTournamentId, tournaments]);

  // Place search autocomplete
  React.useEffect(() => {
    if (!placeQuery.trim() || placeQuery.length < 2) {
      setPlaceSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingPlaces(true);
      try {
        const results = await searchPlaces(placeQuery);
        setPlaceSuggestions(results);
        setShowPlaceDropdown(results.length > 0);
      } catch {
        setPlaceSuggestions([]);
      } finally {
        setIsSearchingPlaces(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [placeQuery]);

  // Select a place from search dropdown
  const handleSelectPlace = (place: PlaceSearchResult) => {
    const coords: Coordinates = { lat: place.lat, lng: place.lng };
    setUserLocation(coords);
    setUserLocationName(place.name);
    setPlaceQuery(place.name);
    setShowPlaceDropdown(false);
    setLocationError(null);
    setStoredUserLocation(coords, place.name);
    setLocationNotice(`Location set to ${place.name}. Distances recalculated.`);

    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([place.lat, place.lng], 14);
    }
  };

  // Submit search directly (e.g. user pressed enter)
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!placeQuery.trim()) return;
    setIsSearchingPlaces(true);
    try {
      const results = await searchPlaces(placeQuery);
      if (results.length > 0) {
        handleSelectPlace(results[0]);
      } else {
        setLocationError(`No matches found for "${placeQuery}". Try typing your town or district.`);
      }
    } finally {
      setIsSearchingPlaces(false);
    }
  };

  /**
   * "Use My Location" handler
   * Strict Requirements:
   * 1. Uses navigator.geolocation.getCurrentPosition()
   * 2. Requests actual browser location permission
   * 3. Extracts latitude, longitude, accuracy
   * 4. Centers map on returned lat/lng
   * 5. Adds/updates "My Location" marker at exact returned coordinates
   * 6. Does NOT silently fall back to Bengaluru, Bangalore, or any hardcoded city
   * 7. Shows exact permission denied message
   * 8. Shows error on timeout/failure without fake mock location
   * 9. enableHighAccuracy: true
   * 10. timeout & maximumAge: 0 configured
   * 11. Logs latitude, longitude, accuracy (meters), and error code/message
   * 12. Marker and map center updated from the SAME result
   */
  const handleUseMyLocation = React.useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      const errMsg = "Geolocation is not supported by your browser.";
      setLocationError(errMsg);
      console.error("[PlayNear Geolocation] Error:", errMsg);
      return;
    }

    setIsLocating(true);
    setLocationError(null);
    setLocationNotice(null);

    const geoOptions: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0, // Force fresh location detection, avoid stale cache
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        // Requirement 11: Log latitude, longitude, and accuracy in meters
        console.log("[PlayNear Geolocation] Latitude:", lat);
        console.log("[PlayNear Geolocation] Longitude:", lng);
        console.log("[PlayNear Geolocation] Accuracy (meters):", accuracy);

        const coords: Coordinates = {
          lat,
          lng,
          accuracy,
        };

        // Requirement 3, 5, 12: Update user location state from the exact result
        setUserLocation(coords);
        setIsLocating(false);

        // Requirement 4, 12: Center Google Map on returned coordinates
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([lat, lng], 14, { animate: true });
        }

        // Reverse geocode place name asynchronously for human-friendly label
        reverseGeocode(lat, lng)
          .then((placeName) => {
            setUserLocationName(placeName);
            setStoredUserLocation(coords, placeName);
          })
          .catch(() => {
            setUserLocationName("My Location");
          });
      },
      (err) => {
        setIsLocating(false);

        // Requirement 11: Log geolocation error code and message
        console.error("[PlayNear Geolocation] Geolocation Error Code:", err.code);
        console.error("[PlayNear Geolocation] Geolocation Error Message:", err.message);

        // Requirement 7: Exact specified message on permission denial
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError(
            "Location permission is required to detect your current location. Please allow location access in your browser."
          );
        } else if (err.code === err.TIMEOUT) {
          setLocationError(
            "Location detection timed out. Please check your GPS/network connection and try again."
          );
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setLocationError(
            "Location information is unavailable on your device. Please ensure location services are enabled."
          );
        } else {
          setLocationError(
            err.message || "Failed to detect your current location. Please try again."
          );
        }
        // Requirement 6, 8, 14: Do NOT fall back to Bangalore, Kochi, or any hardcoded city!
      },
      geoOptions
    );
  }, []);

  // Clear custom location
  const handleClearLocation = () => {
    setUserLocation(null);
    setUserLocationName(null);
    setPlaceQuery("");
    clearStoredUserLocation();
    setLocationNotice(null);
    setSelectedRadius("all");
  };

  // Handle radius pill click
  const handleRadiusSelect = (radius: "all" | "10" | "25" | "50") => {
    setSelectedRadius(radius);
    if (radius !== "all" && !userLocation) {
      // Auto-trigger location detection so filter can work
      handleUseMyLocation();
    }
  };

  // Initialize Leaflet Map with Google Maps Roadmap Tiles
  React.useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (!mapContainerRef.current || mapInstanceRef.current) return;

      const L = (await import("leaflet")).default;
      if (!isMounted || !mapContainerRef.current) return;

      // Determine initial center: user location if already detected, or first tournament, or neutral view
      let initialCenter: [number, number] = [20.5937, 78.9629]; // Neutral India overview
      let initialZoom = 5;

      if (userLocation) {
        initialCenter = [userLocation.lat, userLocation.lng];
        initialZoom = 13;
      } else if (geocodedTournaments.length > 0) {
        initialCenter = [
          geocodedTournaments[0].computedCoords.lat,
          geocodedTournaments[0].computedCoords.lng,
        ];
        initialZoom = 12;
      }

      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: initialZoom,
        zoomControl: false, // Sleek custom floating controls on the right
        dragging: true,
        touchZoom: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
      });

      // Google Maps Roadmap / Satellite / Esri / OSM tiles
      const tileUrl =
        mapStyle === "google"
          ? "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
          : mapStyle === "satellite"
          ? "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
          : mapStyle === "esri"
          ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
          : "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

      const tileAttribution =
        mapStyle === "google" || mapStyle === "satellite"
          ? '&copy; <a href="https://maps.google.com">Google Maps</a>'
          : mapStyle === "esri"
          ? '&copy; <a href="https://www.esri.com/">Esri</a>'
          : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

      L.tileLayer(tileUrl, {
        attribution: tileAttribution,
        maxZoom: 20,
      }).addTo(map);

      mapInstanceRef.current = map;
      radiusLayerRef.current = L.layerGroup().addTo(map);
      markersLayerRef.current = L.layerGroup().addTo(map);

      // Handle map clicks (dismiss dropdowns & interactive location pinning)
      map.on("click", async (e: any) => {
        setShowPlaceDropdown(false);
        if (isPinModeRef.current) {
          const coords: Coordinates = { lat: e.latlng.lat, lng: e.latlng.lng };
          setUserLocation(coords);
          setIsPinMode(false);
          const placeName = await reverseGeocode(coords.lat, coords.lng);
          setUserLocationName(placeName);
          setStoredUserLocation(coords, placeName);
          setLocationNotice(`Location pinned to ${placeName}. Distances recalculated.`);
        }
      });

      // Resize invalidate for smooth rendering
      setTimeout(() => {
        if (isMounted && mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 200);
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mapStyle]);

  // Invalidate map size when side panel toggles
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [showTournamentsPanel]);

  // Render & Update Markers on Map (Tournaments + User "My Location" + Radius Circle)
  React.useEffect(() => {
    async function updateMarkers() {
      if (!mapInstanceRef.current || !markersLayerRef.current) return;

      const L = (await import("leaflet")).default;
      markersLayerRef.current.clearLayers();
      if (radiusLayerRef.current) radiusLayerRef.current.clearLayers();

      const bounds = L.latLngBounds([]);

      // 1. Plot User "My Location" Marker if available (Requirements 4, 5, 12)
      if (userLocation) {
        const userIcon = L.divIcon({
          className: "custom-user-pin",
          html: `
            <div class="relative flex items-center justify-center w-10 h-10 -translate-x-1/2 -translate-y-1/2">
              <span class="absolute w-10 h-10 rounded-full bg-blue-500/25 animate-ping pointer-events-none"></span>
              <span class="absolute w-7 h-7 rounded-full bg-blue-500/35 pointer-events-none"></span>
              <span class="relative w-5 h-5 rounded-full bg-blue-600 border-2 border-white shadow-xl flex items-center justify-center">
                <span class="w-2 h-2 rounded-full bg-white"></span>
              </span>
            </div>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });

        const userMarker = L.marker([userLocation.lat, userLocation.lng], {
          icon: userIcon,
          zIndexOffset: 1000,
          title: "My Location",
        })
          .bindPopup(
            `<div class="p-2 text-center font-sans">
              <p class="font-extrabold text-xs text-blue-600 flex items-center justify-center gap-1">
                <span class="h-2 w-2 rounded-full bg-blue-600"></span> My Location
              </p>
              <p class="text-xs font-semibold text-gray-800 mt-1">${userLocationName || "Detected Location"}</p>
              <p class="text-[10px] text-gray-500 font-mono mt-0.5">${userLocation.lat.toFixed(5)}, ${userLocation.lng.toFixed(5)}</p>
              ${
                typeof userLocation.accuracy === "number"
                  ? `<p class="text-[10px] text-emerald-600 font-medium mt-0.5">Accuracy: ±${Math.round(userLocation.accuracy)}m</p>`
                  : ""
              }
            </div>`
          )
          .addTo(markersLayerRef.current);

        // Accuracy circle
        if (typeof userLocation.accuracy === "number" && userLocation.accuracy > 0) {
          L.circle([userLocation.lat, userLocation.lng], {
            radius: userLocation.accuracy,
            color: "#3b82f6",
            fillColor: "#3b82f6",
            fillOpacity: 0.1,
            weight: 1,
            dashArray: "4, 4",
          }).addTo(markersLayerRef.current);
        }

        // Draw Selected Distance Radius Circle (Requirement 13: 10 km, 25 km, 50 km)
        if (selectedRadius !== "all" && radiusLayerRef.current) {
          const radiusMeters = Number(selectedRadius) * 1000;
          L.circle([userLocation.lat, userLocation.lng], {
            radius: radiusMeters,
            color: "#2563eb",
            fillColor: "#3b82f6",
            fillOpacity: 0.06,
            weight: 2,
            dashArray: "6, 6",
          }).addTo(radiusLayerRef.current);
        }

        userMarkerRef.current = userMarker;
        bounds.extend([userLocation.lat, userLocation.lng]);
      }

      // 2. Plot Tournament Pins (Requirement 13: preserve existing tournament markers)
      radiusFilteredTournaments.forEach((tourney) => {
        const { lat, lng } = tourney.computedCoords;
        const isSelected = activeTournament?.id === tourney.id;

        const sportEmoji =
          tourney.sport?.slug === "cricket"
            ? "🏏"
            : tourney.sport?.slug === "football"
            ? "⚽"
            : tourney.sport?.slug === "kabaddi"
            ? "🤼"
            : tourney.sport?.slug === "volleyball"
            ? "🏐"
            : "🏆";

        const markerHtml = `
          <div class="relative flex flex-col items-center cursor-pointer transition-transform duration-200 ${
            isSelected ? "scale-125 z-50" : "hover:scale-110 z-20"
          }">
            <div class="relative flex items-center justify-center w-10 h-10 rounded-2xl shadow-xl border-2 ${
              isSelected
                ? "bg-gradient-to-tr from-blue-600 to-indigo-600 border-white text-white ring-4 ring-blue-500/30"
                : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
            }">
              <span class="text-lg">${sportEmoji}</span>
              ${
                isSelected
                  ? '<span class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 rounded-full border-2 border-white"></span>'
                  : ""
              }
            </div>
            <div class="w-2.5 h-2.5 rotate-45 -mt-1.5 ${
              isSelected
                ? "bg-indigo-600"
                : "bg-white dark:bg-slate-900 border-r border-b border-slate-300 dark:border-slate-700"
            }"></div>
          </div>
        `;

        const icon = L.divIcon({
          className: "custom-tournament-pin",
          html: markerHtml,
          iconSize: [40, 48],
          iconAnchor: [20, 44],
        });

        L.marker([lat, lng], { icon })
          .addTo(markersLayerRef.current)
          .on("click", () => {
            setActiveTournament(tourney);
            setIsCardMinimized(false);
            onSelectTournament?.(tourney.id);
            mapInstanceRef.current?.flyTo(
              [lat, lng],
              Math.max(mapInstanceRef.current.getZoom(), 13),
              { duration: 0.8 }
            );
          });

        bounds.extend([lat, lng]);
      });

      // Auto-fit if bounds are valid and user hasn't focused on a specific tournament
      if (bounds.isValid() && !activeTournament && !userLocation) {
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
      }
    }

    updateMarkers();
  }, [
    radiusFilteredTournaments,
    activeTournament,
    userLocation,
    userLocationName,
    selectedRadius,
    onSelectTournament,
  ]);

  // Center on tournament and highlight
  const handleSelectTournament = (tourney: typeof geocodedTournaments[0]) => {
    setActiveTournament(tourney);
    setIsCardMinimized(false);
    onSelectTournament?.(tourney.id);

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(
        [tourney.computedCoords.lat, tourney.computedCoords.lng],
        14,
        { duration: 0.8 }
      );
    }
  };

  // Reset view to fit all tournaments & user location
  const handleFitAll = () => {
    if (!mapInstanceRef.current) return;
    import("leaflet").then((L) => {
      const bounds = L.default.latLngBounds([]);
      radiusFilteredTournaments.forEach((t) =>
        bounds.extend([t.computedCoords.lat, t.computedCoords.lng])
      );
      if (userLocation) bounds.extend([userLocation.lat, userLocation.lng]);
      if (bounds.isValid()) {
        mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
      }
    });
  };

  // Google Maps navigation url
  const getDirectionsUrl = (tourney: typeof geocodedTournaments[0]) => {
    const dest = `${tourney.computedCoords.lat},${tourney.computedCoords.lng}`;
    if (userLocation) {
      return `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${dest}`;
    }
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      tourney.venue_address || `${tourney.venue_name}, ${tourney.venue_city}` || dest
    )}`;
  };

  const activeGeocoded = activeTournament
    ? geocodedTournaments.find((t) => t.id === activeTournament.id) || null
    : null;

  return (
    <div className="w-full rounded-2xl border border-border bg-card shadow-md overflow-hidden flex flex-col">
      {/* ── Top Toolbar Bar (Proper framed rectangle box) ── */}
      <div className="p-3 sm:p-4 border-b border-border bg-card/95 backdrop-blur flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Left: Status & Browse All Tournaments Button */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/60 border border-border text-xs font-semibold">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Google Maps</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground font-mono">
                {radiusFilteredTournaments.length}{" "}
                {radiusFilteredTournaments.length === 1 ? "Event" : "Events"}
              </span>
            </div>

            <Button
              size="sm"
              variant={showTournamentsPanel ? "default" : "outline"}
              onClick={() => setShowTournamentsPanel(!showTournamentsPanel)}
              className="h-8 text-xs gap-1.5 rounded-xl font-semibold shadow-sm"
            >
              <List className="h-3.5 w-3.5" />
              <span>Browse Tournaments ({radiusFilteredTournaments.length})</span>
            </Button>

            {userLocationName && (
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-medium max-w-[200px]">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{userLocationName}</span>
                <button
                  onClick={handleClearLocation}
                  className="hover:text-foreground ml-1"
                  title="Clear location"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          {/* Right: Place Search Bar, Use My Location GPS, & Set on Map */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Place / City Search */}
            <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search city / place..."
                value={placeQuery}
                onChange={(e) => {
                  setPlaceQuery(e.target.value);
                  setShowPlaceDropdown(true);
                }}
                onFocus={() => {
                  if (placeSuggestions.length > 0) setShowPlaceDropdown(true);
                }}
                className="w-full pl-8 pr-7 py-1.5 bg-background border border-input rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {placeQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setPlaceQuery("");
                    setShowPlaceDropdown(false);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}

              {/* Places Suggestions Dropdown */}
              {showPlaceDropdown && placeSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-card border border-border rounded-xl shadow-xl p-1.5 divide-y divide-border/40 max-h-56 overflow-y-auto">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Places & Cities
                  </div>
                  {placeSuggestions.map((place, i) => (
                    <button
                      type="button"
                      key={`${place.name}-${i}`}
                      onClick={() => handleSelectPlace(place)}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-muted text-xs flex items-center justify-between gap-2 transition-colors"
                    >
                      <span className="font-medium text-foreground truncate">{place.name}</span>
                      <span className="text-[10px] text-muted-foreground capitalize shrink-0">
                        {place.type || "Place"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </form>

            {/* Requirement 1 & 2: "Use My Location" Button */}
            <Button
              id="use-my-location-btn"
              size="sm"
              type="button"
              variant={userLocation ? "default" : "outline"}
              onClick={handleUseMyLocation}
              disabled={isLocating}
              className={`h-8 px-3 text-xs gap-1.5 rounded-xl transition-all font-semibold shrink-0 shadow-sm ${
                userLocation
                  ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                  : "text-foreground hover:bg-muted"
              }`}
              title="Detect your current location using device GPS"
            >
              {isLocating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-current" />
              ) : (
                <Compass className={`h-3.5 w-3.5 ${userLocation ? "text-white" : "text-primary"}`} />
              )}
              <span>{isLocating ? "Detecting Location..." : "Use My Location"}</span>
            </Button>

            {/* Interactive "Pin on Map" Button */}
            <Button
              size="sm"
              type="button"
              variant={isPinMode ? "default" : "outline"}
              onClick={() => setIsPinMode(!isPinMode)}
              className={`h-8 px-2 text-xs gap-1 rounded-xl transition-all font-semibold shrink-0 ${
                isPinMode ? "bg-amber-600 hover:bg-amber-700 text-white border-amber-600" : ""
              }`}
              title="Click anywhere on the map to set location"
            >
              <MousePointerClick className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{isPinMode ? "Click Map..." : "Pin"}</span>
            </Button>
          </div>
        </div>

        {/* Radius Filter Bar (Requirement 13: Preserve radius filters 10 km, 25 km, 50 km) */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-border/50 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-muted-foreground font-medium text-[11px] flex items-center gap-1">
              <CircleDot className="h-3 w-3 text-blue-500" /> Radius Filter:
            </span>
            {(
              [
                { label: "All Distance", value: "all" },
                { label: "Within 10 km", value: "10" },
                { label: "Within 25 km", value: "25" },
                { label: "Within 50 km", value: "50" },
              ] as const
            ).map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => handleRadiusSelect(r.value)}
                className={`px-2.5 py-0.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedRadius === r.value
                    ? "bg-blue-600 text-white font-semibold shadow-sm"
                    : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Map Layer Switcher (Google Map, Satellite, Esri, OSM) */}
          <div className="flex items-center gap-1 text-[11px]">
            <span className="text-muted-foreground">Layer:</span>
            <button
              type="button"
              onClick={() => setMapStyle("google")}
              className={`px-2 py-0.5 rounded-md ${
                mapStyle === "google"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Google
            </button>
            <button
              type="button"
              onClick={() => setMapStyle("satellite")}
              className={`px-2 py-0.5 rounded-md ${
                mapStyle === "satellite"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Satellite
            </button>
            <button
              type="button"
              onClick={() => setMapStyle("esri")}
              className={`px-2 py-0.5 rounded-md ${
                mapStyle === "esri"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Street
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Pinning Guide Banner */}
      {isPinMode && (
        <div className="px-4 py-2 bg-amber-500/15 border-b border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between animate-in slide-in-from-top-1">
          <div className="flex items-center gap-2">
            <MousePointerClick className="h-4 w-4 animate-bounce shrink-0" />
            <span className="font-semibold">
              Click anywhere on the map to set your location. Distances will recalculate automatically.
            </span>
          </div>
          <button
            onClick={() => setIsPinMode(false)}
            className="text-xs underline hover:no-underline font-semibold ml-2"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Location Notice Notification */}
      {locationNotice && (
        <div className="px-4 py-2 bg-blue-500/10 border-b border-blue-500/20 text-blue-800 dark:text-blue-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 shrink-0 text-blue-600" />
            <span>{locationNotice}</span>
          </div>
          <button onClick={() => setLocationNotice(null)} className="hover:opacity-75 p-0.5">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Requirement 7 & 8: Location Error Notification */}
      {locationError && (
        <div className="px-4 py-2 bg-rose-500/10 border-b border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
          <span className="font-medium">{locationError}</span>
          <button onClick={() => setLocationError(null)} className="hover:opacity-75">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Main Map Canvas with Side Drawer for All Tournaments ── */}
      <div className="relative w-full h-[520px] sm:h-[600px] lg:h-[650px] flex overflow-hidden">
        {/* Browse All Tournaments Side Drawer */}
        {showTournamentsPanel && (
          <aside className="w-full sm:w-84 md:w-96 border-r border-border bg-card/95 backdrop-blur-md flex flex-col z-30 shrink-0 animate-in slide-in-from-left duration-200 shadow-xl">
            <div className="p-3.5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                  <Trophy className="h-4 w-4 text-primary" />
                  Available Tournaments
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Showing {browseTournaments.length} of {radiusFilteredTournaments.length} events
                  {selectedRadius !== "all" && ` (${selectedRadius} km radius)`}
                </p>
              </div>
              <button
                onClick={() => setShowTournamentsPanel(false)}
                className="h-7 w-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Filter controls inside panel */}
            <div className="p-3 border-b border-border space-y-2 bg-muted/20">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter tournaments…"
                  value={tournamentSearch}
                  onChange={(e) => setTournamentSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 bg-background border border-input rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Sport pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] scrollbar-none">
                {["all", "cricket", "football", "kabaddi", "volleyball"].map((sport) => (
                  <button
                    key={sport}
                    onClick={() => setSelectedSportFilter(sport)}
                    className={`px-2 py-0.5 rounded-md font-medium capitalize shrink-0 transition-colors ${
                      selectedSportFilter === sport
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {sport}
                  </button>
                ))}
              </div>
            </div>

            {/* Tournament Cards List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 divide-y divide-border/40">
              {browseTournaments.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground space-y-2">
                  <Trophy className="h-8 w-8 mx-auto opacity-40" />
                  <p className="text-xs font-semibold">No tournaments match your criteria.</p>
                  {selectedRadius !== "all" && (
                    <p className="text-[11px] text-muted-foreground">
                      Try expanding the radius to 25 km or 50 km.
                    </p>
                  )}
                </div>
              ) : (
                browseTournaments.map((t) => {
                  const isSelected = activeTournament?.id === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => handleSelectTournament(t)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer pt-3 ${
                        isSelected
                          ? "bg-primary/10 border-primary/40 shadow-sm"
                          : "bg-card border-border hover:border-primary/30 hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.2 rounded-full capitalize">
                              {t.sport?.name || "Sport"}
                            </span>
                            {t.distanceFromUser !== null && (
                              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded-full">
                                {formatDistance(t.distanceFromUser)}
                              </span>
                            )}
                          </div>

                          <h4 className="font-bold text-xs sm:text-sm text-foreground leading-tight truncate">
                            {t.title}
                          </h4>

                          <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 truncate">
                            <MapPin className="h-3 w-3 text-primary shrink-0" />
                            {t.venue_name}, {t.venue_city}
                          </p>

                          <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground font-mono">
                            <span>{formatDate(t.tournament_start_date)}</span>
                            <span>•</span>
                            <span className="font-bold text-foreground">
                              {t.entry_fee === 0 ? "Free" : formatCurrency(t.entry_fee, t.currency)}
                            </span>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-primary hover:bg-primary/10 shrink-0 gap-0.5"
                        >
                          <span>Locate</span> <ChevronRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        )}

        {/* ── Interactive Google Map Canvas (Full Drag & Zoom Enabled) ── */}
        <div className="relative flex-1 h-full w-full overflow-hidden">
          <div
            ref={mapContainerRef}
            className={`absolute inset-0 z-10 w-full h-full bg-slate-100 dark:bg-slate-900 ${
              isPinMode ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"
            }`}
            style={{ touchAction: "pan-x pan-y" }}
          />

          {/* ── Modern Custom Zoom & Reset Controls (Positioned at Bottom-Right with High Z-Index) ── */}
          <div className="absolute bottom-5 right-5 z-30 flex flex-col items-center gap-1.5 pointer-events-auto">
            <button
              type="button"
              onClick={() => mapInstanceRef.current?.zoomIn()}
              className="h-9 w-9 rounded-xl bg-card/95 dark:bg-slate-900/95 backdrop-blur-md border border-border shadow-lg hover:bg-muted text-foreground flex items-center justify-center transition-all active:scale-90 font-bold"
              title="Zoom In"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => mapInstanceRef.current?.zoomOut()}
              className="h-9 w-9 rounded-xl bg-card/95 dark:bg-slate-900/95 backdrop-blur-md border border-border shadow-lg hover:bg-muted text-foreground flex items-center justify-center transition-all active:scale-90 font-bold"
              title="Zoom Out"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleFitAll}
              className="h-9 w-9 rounded-xl bg-card/95 dark:bg-slate-900/95 backdrop-blur-md border border-border shadow-lg hover:bg-muted text-foreground flex items-center justify-center transition-all active:scale-90"
              title="Fit All Tournaments & Location"
            >
              <Maximize2 className="h-4 w-4 text-primary" />
            </button>
          </div>

          {/* ── Floating Tournament Preview Card (Positioned at Bottom-Left to Avoid Zoom Controls) ── */}
          {activeGeocoded && (
            <div className="absolute bottom-4 left-4 sm:bottom-5 sm:left-5 z-20 pointer-events-none max-w-[calc(100%-6.5rem)] sm:max-w-md w-full">
              {isCardMinimized ? (
                /* Minimized Pill Bar */
                <div className="bg-card/95 dark:bg-slate-900/95 backdrop-blur-md border border-border text-foreground px-3.5 py-2.5 rounded-2xl shadow-xl flex items-center justify-between gap-3 pointer-events-auto animate-in fade-in duration-150">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-base shrink-0">
                      {activeGeocoded.sport?.slug === "cricket"
                        ? "🏏"
                        : activeGeocoded.sport?.slug === "football"
                        ? "⚽"
                        : activeGeocoded.sport?.slug === "kabaddi"
                        ? "🤼"
                        : activeGeocoded.sport?.slug === "volleyball"
                        ? "🏐"
                        : "🏆"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-xs text-foreground truncate">{activeGeocoded.title}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {activeGeocoded.venue_city}
                        {activeGeocoded.distanceFromUser !== null &&
                          ` • ${formatDistance(activeGeocoded.distanceFromUser)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsCardMinimized(false)}
                      className="h-7 px-2 text-[11px] font-semibold text-primary hover:bg-primary/10 rounded-lg flex items-center gap-1"
                    >
                      <span>Expand</span>
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTournament(null)}
                      className="h-7 w-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
                      title="Close"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Full Expanded Tournament Card */
                <div className="bg-card/95 dark:bg-slate-900/95 backdrop-blur-md border border-border text-foreground p-4 sm:p-5 rounded-2xl shadow-2xl pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="sports" className="text-[10px] py-0 px-2 uppercase font-semibold">
                          {activeGeocoded.format?.replace(/_/g, " ") || "Tournament"}
                        </Badge>
                        {activeGeocoded.status === "REGISTRATION_OPEN" ? (
                          <Badge variant="success" className="text-[10px] py-0 px-2">Registration Open</Badge>
                        ) : activeGeocoded.status === "REGISTRATION_CLOSED" ? (
                          <Badge variant="warning" className="text-[10px] py-0 px-2">Registration Closed</Badge>
                        ) : activeGeocoded.status === "ONGOING" ? (
                          <Badge variant="live" className="text-[10px] py-0 px-2">Live Now</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] py-0 px-2">{activeGeocoded.status?.replace(/_/g, " ")}</Badge>
                        )}
                        {activeGeocoded.sport && (
                          <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full capitalize">
                            {activeGeocoded.sport.name}
                          </span>
                        )}
                        {activeGeocoded.distanceFromUser !== null && (
                          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Locate className="h-3 w-3" />
                            {formatDistance(activeGeocoded.distanceFromUser)}
                          </span>
                        )}
                      </div>

                      <h4 className="font-extrabold text-sm sm:text-base text-foreground truncate leading-tight pt-1">
                        {activeGeocoded.title}
                      </h4>

                      <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                        <MapPin className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        <span className="truncate">
                          {activeGeocoded.venue_name} — {activeGeocoded.venue_city}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setIsCardMinimized(true)}
                        className="h-6 w-6 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
                        title="Minimize"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTournament(null)}
                        className="h-6 w-6 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
                        title="Close"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 w-full pt-3 mt-3 border-t border-border/60">
                    <a
                      href={getDirectionsUrl(activeGeocoded)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1"
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-1.5 text-xs font-semibold rounded-xl border-border hover:bg-muted"
                      >
                        <Navigation className="h-3.5 w-3.5 text-emerald-500" />
                        Directions
                      </Button>
                    </a>

                    <Link href={`/tournaments/${activeGeocoded.slug}`} className="flex-1">
                      <Button
                        variant="sports"
                        size="sm"
                        className="w-full text-xs font-semibold gap-1.5 rounded-xl shadow-md"
                      >
                        <Trophy className="h-3.5 w-3.5" />
                        View Details
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
