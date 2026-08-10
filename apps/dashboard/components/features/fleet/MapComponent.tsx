'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom Icon for Riders
const createRiderIcon = (initials: string, color: string) => {
  return L.divIcon({
    className: 'custom-rider-icon',
    html: `
      <div style="position: relative; display: flex; flex-direction: column; items: center;">
        <div style="background-color: ${color}; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); border: 4px solid white;">
          ${initials}
        </div>
        <div style="width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 10px solid ${color}; margin-top: -2px; align-self: center;"></div>
      </div>
    `,
    iconSize: [40, 50],
    iconAnchor: [20, 50],
    popupAnchor: [0, -50],
  });
};

const createDestinationIcon = () => {
  return L.divIcon({
    className: 'custom-dest-icon',
    html: `
      <div style="background-color: #131b2e; color: white; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); border: 2px solid white;">
        <span class="material-symbols-outlined" style="font-size: 16px;">home</span>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

// Map Control Component to Fit Bounds
function FitBounds({ riders }: { riders: any[] }) {
  const map = useMap();
  useEffect(() => {
    if (riders.length > 0) {
      const bounds = L.latLngBounds(riders.map(r => [r.location?.lat || 24.8607, r.location?.lng || 67.0011]));
      // add destinations to bounds
      riders.forEach(r => {
        if (r.currentDelivery) {
          bounds.extend([r.currentDelivery.destinationLat, r.currentDelivery.destinationLng]);
        }
      });
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [riders, map]);
  return null;
}

export default function MapComponent({ riders, center = [24.8607, 67.0011] }: { riders: any[], center?: [number, number] }) {
  return (
    <div className="w-full h-full relative z-0">
      <MapContainer 
        center={center} 
        zoom={12} 
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        
        {riders.map(rider => {
          if (!rider.location) return null;
          
          return (
            <div key={rider.id}>
              <Marker 
                position={[rider.location.lat, rider.location.lng]}
                icon={createRiderIcon(rider.avatarInitials, rider.avatarColor)}
              >
                <Popup>
                  <div className="text-sm font-bold">{rider.name}</div>
                  <div className="text-xs text-gray-500">{rider.status}</div>
                  {rider.currentDelivery && (
                    <div className="mt-1 text-xs">
                      Delivering to: {rider.currentDelivery.customerName}
                    </div>
                  )}
                </Popup>
              </Marker>

              {rider.currentDelivery && rider.currentDelivery.stage !== 'DELIVERED' && (
                <>
                  <Polyline 
                    positions={[
                      [rider.location.lat, rider.location.lng],
                      [rider.currentDelivery.destinationLat, rider.currentDelivery.destinationLng]
                    ]}
                    pathOptions={{ color: '#FF5722', dashArray: '10, 10', weight: 4 }}
                  />
                  <Marker 
                    position={[rider.currentDelivery.destinationLat, rider.currentDelivery.destinationLng]}
                    icon={createDestinationIcon()}
                  >
                    <Popup>
                      <div className="text-sm font-bold">Destination</div>
                      <div className="text-xs text-gray-500">{rider.currentDelivery.orderNumber}</div>
                    </Popup>
                  </Marker>
                </>
              )}
            </div>
          );
        })}

        <FitBounds riders={riders.filter(r => r.location)} />
      </MapContainer>
    </div>
  );
}
