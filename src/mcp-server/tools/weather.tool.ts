export const handleWeatherQuery = (location: string) => {
  const mockWeatherMap = {
    London: {
      temperature: 20,
      description: 'Partly cloudy',
    },
    'New York': {
      temperature: 15,
      description: 'Sunny',
    },
    Tokyo: {
      temperature: 25,
      description: 'Rainy',
    },
  };
  return Promise.resolve(
    mockWeatherMap[location] || {
      temperature: 0,
      description: 'Unknown', // TODO: fetch real weather data
    },
  );
};
