import { useState } from 'react';

const BASE = '/assets/mars';

export default function BrandAsset({ name, alt = '', className = '', fallback = null }) {
  const [failed, setFailed] = useState(false);

  if (failed) return fallback;

  return (
    <img
      src={`${BASE}/${name}`}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
      draggable="false"
    />
  );
}
