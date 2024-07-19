import React, { useState, useEffect } from 'react';

interface OrientationData {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
}

const GyroscopeComponent: React.FC = () => {
  const [orientation, setOrientation] = useState<OrientationData>({ alpha: null, beta: null, gamma: null });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleOrientation = (event: DeviceOrientationEvent) => {
      setOrientation({
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma,
      });
    };

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

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, []);

  return (
    <div>
      <h2>Gyroscope Data</h2>
      {error ? (
        <p>Error: {error}</p>
      ) : (
        <>
          <p>Alpha: {orientation.alpha !== null ? orientation.alpha.toFixed(2) : 'No data'}</p>
          <p>Beta: {orientation.beta !== null ? orientation.beta.toFixed(2) : 'No data'}</p>
          <p>Gamma: {orientation.gamma !== null ? orientation.gamma.toFixed(2) : 'No data'}</p>
        </>
      )}
    </div>
  );
};

export default GyroscopeComponent;
