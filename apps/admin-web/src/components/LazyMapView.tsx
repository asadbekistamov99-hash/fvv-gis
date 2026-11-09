import { lazy, Suspense, type ComponentProps } from "react";
import { translate } from "../i18n";

const MapView = lazy(() => import("./MapView"));

export default function LazyMapView(props: ComponentProps<typeof MapView>) {
  return <Suspense fallback={<div className="loading map-loading" role="status">{translate(props.language, "map")}…</div>}><MapView {...props}/></Suspense>;
}
