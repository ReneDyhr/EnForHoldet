export const formatDuration = (milliseconds: number): string => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
};

export const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
};

export const formatWeight = (grams: number): string => {
  if (grams === 0) return '0 kg';
  const kg = grams / 1000;
  if (kg < 1) {
    return `${grams} g`;
  }
  return `${kg.toFixed(2)} kg`;
};

export const formatCategories = (categories: string[] | undefined): string => {
  if (!categories || categories.length === 0) {
    return 'No categories';
  }
  return categories.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ');
};

