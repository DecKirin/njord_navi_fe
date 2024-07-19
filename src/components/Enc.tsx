//@ts-ignore
//eslint-disable-next-line import/no-webpack-loader-syntax
import maplibregl from '!maplibre-gl';

//@ts-ignore
//eslint-disable-next-line import/no-webpack-loader-syntax
import MapLibreWorker from '!maplibre-gl/dist/maplibre-gl-csp-worker';

import {useRef, useEffect, useState} from "react";
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import Accordion from 'react-bootstrap/Accordion';
import '../App.css'
import 'maplibre-gl/dist/maplibre-gl.css';
import ChartQuery from './ChartQuery';
import {MapLibreEvent, MapMouseEvent, Map, MapGeoJSONFeature} from "maplibre-gl";
import {DepthUnit, Theme} from "../App";
import {Bounds} from "./Chartinfo";

maplibregl.workerClass = MapLibreWorker;

interface OrientationData {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
}

export class EncState {
    lng: number = parseFloat(window.localStorage.getItem("longitude") ?? "-122.4002");
    lat: number = parseFloat(window.localStorage.getItem("latitude") ?? "47.27984");
    zoom: number = parseFloat(window.localStorage.getItem("zoom") ?? "11.0");
}

export function storeEncState(state: EncState) {
    window.localStorage.setItem("longitude", `${state.lng}`)
    window.localStorage.setItem("latitude", `${state.lat}`)
    window.localStorage.setItem("zoom", `${state.zoom}`)
    console.log(`stored EncState = ${JSON.stringify(state)}`)
}

var destination: Bounds | null = null

export function setDestination(bounds: Bounds) {
    destination = bounds;
}

type EncProps = {
    depths: DepthUnit,
    theme: Theme,
    custom: string | null,
}

function scaleUnit(depths: DepthUnit) {
    switch (depths) {
        case DepthUnit.meters:
            return "metric"
        case DepthUnit.feet:
            return "nautical"
        case DepthUnit.fathoms:
            return "nautical"
        default:
            return "nautical"
    }
}

export function Enc(props: EncProps) {
    const mapContainer = useRef(null);
    const map = useRef<Map | null>(null);
    const [show, setShow] = useState<MapGeoJSONFeature[] | null>(null);
    const handleClose = () => setShow(null);

    const encUpdater = (state: EncState) => {
        storeEncState(state);
    }

    const prevAlphaRef = useRef<number | null>(null);

    const [orientation, setOrientation] = useState<OrientationData>({ alpha: null, beta: null, gamma: null });
    const threshold = 5; // Define the threshold for delta alpha
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cMap: Map | null = map.current
        if (cMap) {
            let url = `/v1/style/${props.depths}/${props.theme}?c=${props.custom}`
            console.log(`loading style url ${url}`)
            cMap?.setStyle(url)
            return; //stops map from intializing more than once
        }

        let encState = new EncState();
        let newMap = new maplibregl.Map({
            container: mapContainer.current,
            style: `/v1/style/${props.depths}/${props.theme}?c=${props.custom}`,
            center: [encState.lng, encState.lat],
            zoom: encState.zoom
        });

        newMap.addControl(new maplibregl.NavigationControl(), 'bottom-right');
        newMap.addControl(new maplibregl.ScaleControl({unit: scaleUnit(props.depths)}));

        navigator.geolocation.getCurrentPosition((position) => {
            const currentLng = position.coords.longitude;
            const currentLat = position.coords.latitude;

            new maplibregl.Marker({color: "#FF0000"})
                .setLngLat([currentLng, currentLat])
                .addTo(newMap);

            encUpdater({
                lat: currentLat,
                lng: currentLng,
                zoom: 11,
            });

            console.log(`Enc lat = ${currentLat.toString()}`);
            console.log(`Enc log = ${currentLng.toString()}`);
        }, (error) => {
            console.error("Error getting the current location", error);
        });

        // new maplibregl.Marker({color: "#FF0000"})
        //     .setLngLat([currentLat, currentLng])
        //     .addTo(newMap);

        newMap.on('moveend', function (e: MapLibreEvent<MouseEvent | TouchEvent | WheelEvent | undefined>) {
            let center = e.target.getCenter();
            let zoom = e.target.getZoom();
            console.log(`moved to Zoom(${zoom}) ${center.toString()}`)
            encUpdater({
                lat: center.lat,
                lng: center.lng,
                zoom: zoom,
            });
        });


        newMap.on('click', function (e: MapMouseEvent) {
            const bbox = [
                [e.point.x - 5, e.point.y - 5],
                [e.point.x + 5, e.point.y + 5]
            ];
            let lnams = new Set<string>();
            let features = newMap.queryRenderedFeatures(bbox);
            let filtered = features.filter((each: MapGeoJSONFeature) => {
                let lnam = each.properties["LNAM"]
                if (lnam) {
                    let f = !lnams.has(lnam);
                    lnams.add(lnam)
                    return f;
                } else {
                    return true;
                }
            })
            setShow(filtered);
        });
        map.current = newMap

        const handleOrientation = (event: DeviceOrientationEvent) => {
          const alpha = event.alpha;
          if (alpha !== null) {
            const prevAlpha = prevAlphaRef.current;

            // Update the map bearing if the delta exceeds the threshold
            if (prevAlpha === null || Math.abs(alpha - prevAlpha) > threshold) {
              if (map.current) {
                map.current.setBearing(alpha);
              }
              prevAlphaRef.current = alpha;
            }
          }
        };

        // const handleOrientation = (e: DeviceOrientationEvent) => {
        //   const alpha = e.alpha;
        //   if (map.current && alpha !== null) {
        //     map.current.setBearing(alpha);
        //   }
        // };

        const requestPermission = async () => {
          // Check if the requestPermission method exists
          if ((DeviceMotionEvent as any).requestPermission) {
            try {
              const permissionState = await (DeviceMotionEvent as any).requestPermission();
              if (permissionState === 'granted') {
                window.addEventListener('deviceorientation', handleOrientation);
              } else {
                setError('Permission denied for accessing device motion data.');
              }
            } catch (err) {
              console.error('Error requesting permission', err);
              setError('Error requesting permission for accessing device motion data.');
            }
          } else {
            // Add event listener for devices that do not require permission
            window.addEventListener('deviceorientation', handleOrientation);
          }
        };

        requestPermission();

        if (destination) {
            newMap.fitBounds([[destination.leftLng, destination.topLat], [destination.rightLng, destination.bottomLat]])
            destination = null
        }
    });

    function clipboard() {
        navigator.clipboard.writeText(JSON.stringify(show));
    }

    return (
        <>
            <div ref={mapContainer} className="Fill"></div>
            <Modal show={show != null} onHide={handleClose} dialogClassName="modal-xl">
                <Modal.Header closeButton><Modal.Title>Chart Query</Modal.Title></Modal.Header>
                <Modal.Body>
                    <DisplayQuery object={show}/>
                    <Modal.Footer>
                        <Button variant="primary" onClick={clipboard}>Copy Json</Button>
                        <Button variant="secondary" onClick={handleClose}>Close</Button>
                    </Modal.Footer>
                </Modal.Body>
            </Modal>
        </>
    );
}

type DisplayQueryProps = {
    object: MapGeoJSONFeature[] | null
}

function DisplayQuery(props: DisplayQueryProps) {
    if (props.object) {
        return (
            <>
                <Accordion>
                    {
                        props.object.map((each, i) => {
                            return <ChartQuery key={i} feature={each} eventKey={`${i}`}/>
                        })
                    }
                </Accordion>
            </>
        );
    } else {
        return (<></>);
    }
}
