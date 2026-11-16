import { useEffect, useRef, useState, type ReactNode } from "react";
import * as maplibregl from "maplibre-gl";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import type { FeatureCollection } from "geojson";
import {
  Crosshair,
  Layers,
  Minus,
  MousePointer2,
  Plus,
  Ruler,
  RotateCcw,
} from "lucide-react";
import type { Geometry, Infrastructure, Language } from "../types";
import { translate } from "../i18n";

maplibregl.setWorkerUrl(mapWorkerUrl);

interface Props {
  objects: Infrastructure[];
  language: Language;
  onSelect?: (object: Infrastructure) => void;
  expanded?: boolean;
  drawType?: Geometry["type"];
  onDraw?: (geometry: Geometry) => void;
  routeGeometry?: import("geojson").LineString;
}
const blank: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#e5ece7" },
    },
  ],
};
const dataLayers = [
  "object-points",
  "object-lines",
  "object-polygons",
  "clusters",
  "cluster-count",
];

export default function MapView({
  objects,
  language,
  onSelect,
  expanded = false,
  drawType,
  onDraw,
  routeGeometry,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const objectsRef = useRef(objects);
  const selectRef = useRef(onSelect);
  const drawRef = useRef({ drawType, onDraw });
  const points = useRef<number[][]>([]);
  const routeRef = useRef(routeGeometry);
  routeRef.current = routeGeometry;
  const segments = useRef<number[][][]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const [layer, setLayer] = useState(true);
  const layerRef = useRef(layer);
  const [measure, setMeasure] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [locationError, setLocationError] = useState("");
  const measureRef = useRef(false);
  const measurePoints = useRef<number[][]>([]);
  objectsRef.current = objects;
  selectRef.current = onSelect;
  drawRef.current = { drawType, onDraw };
  measureRef.current = measure;
  layerRef.current = layer;
  const collection = (pointOnly: boolean): FeatureCollection => ({
    type: "FeatureCollection",
    features: objectsRef.current
      .filter((o) => (o.geometry.type === "Point") === pointOnly)
      .map((o) => ({
        type: "Feature",
        geometry: o.geometry,
        properties: {
          id: o.id,
          name: o.name,
          status: o.operational_status,
          code: o.code,
        },
      })),
  });
  function updateDrawing() {
    const current = map.current;
    const source = current?.getSource("drawing") as
      maplibregl.GeoJSONSource | undefined;
    const p = points.current;
    const features: FeatureCollection["features"] = p.map((coordinates) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates },
      properties: {},
    }));
    if (p.length >= 2)
      features.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: p },
        properties: {},
      });
    source?.setData({ type: "FeatureCollection", features });
  }
  function capture(coordinates: number[]) {
    const d = drawRef.current;
    if (!d.drawType || !d.onDraw) return;
    points.current.push(coordinates);
    const p = points.current;
    if (d.drawType === "Point") {
      points.current = p.slice(-1);
      d.onDraw({ type: "Point", coordinates: points.current[0] });
    } else if (d.drawType === "LineString" && p.length >= 2)
      d.onDraw({ type: "LineString", coordinates: [...p] });
    else if (d.drawType === "MultiLineString" && p.length >= 2)
      d.onDraw({
        type: "MultiLineString",
        coordinates: [...segments.current, [...p]],
      });
    else if (d.drawType === "Polygon" && p.length >= 3)
      d.onDraw({ type: "Polygon", coordinates: [[...p, p[0]]] });
    else if (d.drawType === "MultiPolygon" && p.length >= 3)
      d.onDraw({ type: "MultiPolygon", coordinates: [[[...p, p[0]]]] });
    updateDrawing();
  }
  useEffect(() => {
    if (!container.current) return;
    let current: maplibregl.Map;
    let disposed = false;
    const controller = new AbortController();
    try {
      current = new maplibregl.Map({
        container: container.current,
        style: blank,
        center: [64.65, 41.25],
        zoom: 5.3,
        attributionControl: false,
      });
    } catch {
      setUnavailable(true);
      return;
    }
    map.current = current;
    current.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution:
          '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a> · FVV GIS',
      }),
      "bottom-right",
    );
    const addData = () => {
      if (current.getSource("infrastructure-points")) return;
      current.addSource("infrastructure-points", {
        type: "geojson",
        data: collection(true),
        cluster: true,
        clusterMaxZoom: 12,
        clusterRadius: 42,
      });
      current.addSource("infrastructure-shapes", {
        type: "geojson",
        data: collection(false),
      });
      current.addSource("drawing", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      const visibility = layerRef.current ? "visible" : "none";
      current.addLayer({
        id: "clusters",
        type: "circle",
        source: "infrastructure-points",
        filter: ["has", "point_count"],
        layout: { visibility },
        paint: {
          "circle-color": "#173e35",
          "circle-radius": 22,
          "circle-stroke-width": 4,
          "circle-stroke-color": "#ffffff",
        },
      });
      current.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "infrastructure-points",
        filter: ["has", "point_count"],
        layout: {
          visibility,
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 15,
          "text-font": ["Noto Sans Regular"],
        },
        paint: { "text-color": "#fff" },
      });
      current.addLayer({
        id: "object-polygons",
        type: "fill",
        source: "infrastructure-shapes",
        filter: ["==", ["geometry-type"], "Polygon"],
        layout: { visibility },
        paint: { "fill-color": "#367b5f", "fill-opacity": 0.32 },
      });
      current.addLayer({
        id: "object-lines",
        type: "line",
        source: "infrastructure-shapes",
        filter: ["==", ["geometry-type"], "LineString"],
        layout: { visibility },
        paint: {
          "line-color": [
            "match",
            ["get", "status"],
            "faulty",
            "#a8231c",
            "#176443",
          ],
          "line-width": 6,
        },
      });
      current.addLayer({
        id: "object-points",
        type: "circle",
        source: "infrastructure-points",
        filter: ["!", ["has", "point_count"]],
        layout: { visibility },
        paint: {
          "circle-color": [
            "match",
            ["get", "status"],
            "working",
            "#176443",
            "faulty",
            "#a8231c",
            "under_maintenance",
            "#925600",
            "#415260",
          ],
          "circle-radius": 10,
          "circle-stroke-width": 3,
          "circle-stroke-color": "#fff",
        },
      });
      current.addLayer({
        id: "drawing-line",
        type: "line",
        source: "drawing",
        filter: ["==", ["geometry-type"], "LineString"],
        paint: { "line-color": "#087cbe", "line-width": 4 },
      });
      current.addLayer({
        id: "drawing-points",
        type: "circle",
        source: "drawing",
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-radius": 7,
          "circle-color": "#087cbe",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fff",
        },
      });
      current.addSource("approved-route", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: routeRef.current
            ? [{ type: "Feature", geometry: routeRef.current, properties: {} }]
            : [],
        },
      });
      current.addLayer({
        id: "approved-route-outline",
        type: "line",
        source: "approved-route",
        paint: { "line-color": "#fff", "line-width": 9 },
      });
      current.addLayer({
        id: "approved-route-line",
        type: "line",
        source: "approved-route",
        paint: { "line-color": "#075e93", "line-width": 5 },
      });
      updateDrawing();
    };
    current.on("load", addData);
    current.on("style.load", addData);
    current.on("click", (event) => {
      if (drawRef.current.drawType) {
        capture([
          Number(event.lngLat.lng.toFixed(7)),
          Number(event.lngLat.lat.toFixed(7)),
        ]);
        return;
      }
      if (measureRef.current) {
        measurePoints.current.push([event.lngLat.lng, event.lngLat.lat]);
        if (measurePoints.current.length > 2)
          measurePoints.current = measurePoints.current.slice(-2);
        if (measurePoints.current.length === 2) {
          const [a, b] = measurePoints.current;
          const radians = (v: number) => (v * Math.PI) / 180;
          const h =
            Math.sin(radians(b[1] - a[1]) / 2) ** 2 +
            Math.cos(radians(a[1])) *
              Math.cos(radians(b[1])) *
              Math.sin(radians(b[0] - a[0]) / 2) ** 2;
          setDistance(
            6371008.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)),
          );
        }
        return;
      }
      const layers = dataLayers.filter((id) => current.getLayer(id));
      const feature = current.queryRenderedFeatures(event.point, { layers })[0];
      if (!feature) return;
      if (feature.properties?.cluster_id) {
        current.easeTo({ center: event.lngLat, zoom: current.getZoom() + 2 });
        return;
      }
      const object = objectsRef.current.find(
        (o) => o.id === feature.properties?.id,
      );
      if (object) selectRef.current?.(object);
    });
    current.on("mousemove", (event) => {
      if (drawRef.current.drawType || measureRef.current) {
        current.getCanvas().style.cursor = "crosshair";
        return;
      }
      const layers = dataLayers.filter((id) => current.getLayer(id));
      current.getCanvas().style.cursor =
        layers.length &&
        current.queryRenderedFeatures(event.point, { layers }).length
          ? "pointer"
          : "";
    });
    fetch(import.meta.env.VITE_MAP_STYLE_URL || "/tiles/style.json", {
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((style) => {
        if (style.version !== 8) throw Error();
        if (!disposed) current.setStyle(style);
      })
      .catch(() => {
        if (!disposed) setUnavailable(true);
      });
    return () => {
      disposed = true;
      controller.abort();
      current.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    for (const [id, pointOnly] of [
      ["infrastructure-points", true],
      ["infrastructure-shapes", false],
    ] as const) {
      const source = map.current?.getSource(id) as
        maplibregl.GeoJSONSource | undefined;
      source?.setData(collection(pointOnly));
    }
  }, [objects]);
  useEffect(() => {
    const current = map.current;
    const source = current?.getSource("approved-route") as
      maplibregl.GeoJSONSource | undefined;
    source?.setData({
      type: "FeatureCollection",
      features: routeGeometry
        ? [{ type: "Feature", geometry: routeGeometry, properties: {} }]
        : [],
    });
    if (current && routeGeometry?.coordinates.length) {
      const bounds = new maplibregl.LngLatBounds();
      for (const [longitude, latitude] of routeGeometry.coordinates)
        bounds.extend([longitude, latitude]);
      current.fitBounds(bounds, { padding: 70, maxZoom: 15 });
    }
  }, [routeGeometry]);
  useEffect(() => {
    const current = map.current;
    if (!current?.isStyleLoaded()) return;
    for (const id of dataLayers)
      if (current.getLayer(id))
        current.setLayoutProperty(id, "visibility", layer ? "visible" : "none");
  }, [layer]);
  useEffect(() => {
    points.current = [];
    segments.current = [];
    updateDrawing();
  }, [drawType]);
  function locate() {
    if (!navigator.geolocation) {
      setLocationError(translate(language, "gpsUnavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        map.current?.flyTo({
          center: [p.coords.longitude, p.coords.latitude],
          zoom: 14,
        });
        setLocationError("");
        if (drawRef.current.drawType === "Point")
          capture([p.coords.longitude, p.coords.latitude]);
      },
      () => setLocationError(translate(language, "gpsDenied")),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }
  const label = (key: Parameters<typeof translate>[1]) =>
    translate(language, key);
  const control = (
    title: string,
    action: () => void,
    icon: ReactNode,
    active = false,
  ) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      className={active ? "active" : ""}
      onClick={action}
    >
      {icon}
    </button>
  );
  return (
    <div
      className={`map-wrap ${expanded ? "expanded-map" : ""} ${drawType ? "drawing" : ""}`}
    >
      <div ref={container} className="map-canvas" aria-label={label("map")} />
      <div className="map-top">
        <span className="map-chip">
          <span className="live-dot" />
          {label("map")}
        </span>
        <span className="map-chip muted-chip">
          {objects.length} {label("objects")}
        </span>
      </div>
      {unavailable && (
        <div className="basemap-notice">{label("mapUnavailable")}</div>
      )}
      <div className="map-tools">
        {control(label("location"), locate, <Crosshair size={21} />)}
        {control(
          label("legend"),
          () => setLayer((v) => !v),
          <Layers size={21} />,
          !layer,
        )}
        {control(
          label("distance"),
          () => {
            setMeasure((v) => !v);
            setDistance(null);
            measurePoints.current = [];
          },
          <Ruler size={21} />,
          measure,
        )}
        <div className="map-tools-gap" />
        {control(
          label("zoomIn"),
          () => map.current?.zoomIn(),
          <Plus size={21} />,
        )}
        {control(
          label("zoomOut"),
          () => map.current?.zoomOut(),
          <Minus size={21} />,
        )}
        {drawType &&
          control(
            label("clear"),
            () => {
              points.current = [];
              segments.current = [];
              updateDrawing();
            },
            <RotateCcw size={21} />,
          )}
        {drawType === "MultiLineString" &&
          control(
            label("newSegment"),
            () => {
              if (points.current.length >= 2) {
                segments.current.push([...points.current]);
                points.current = [points.current.at(-1)!];
                updateDrawing();
              }
            },
            <Plus size={21} />,
          )}
      </div>
      <div className="map-legend">
        <span>
          <i className="legend-dot green" />
          {label("working")}
        </span>
        <span>
          <i className="legend-dot red" />
          {label("faulty")}
        </span>
        <span>
          <i className="legend-dot amber" />
          {label("maintenance")}
        </span>
      </div>
      {drawType && (
        <div className="map-instruction">
          <MousePointer2 size={16} />
          {label("drawInstruction")} · {drawType}
        </div>
      )}
      {measure && (
        <div className="map-instruction">
          <Ruler size={16} />
          {distance !== null
            ? `${(distance / 1000).toFixed(2)} km · WGS84`
            : label("measureInstruction")}
        </div>
      )}
      {locationError && (
        <div className="map-instruction error-text">{locationError}</div>
      )}
    </div>
  );
}
