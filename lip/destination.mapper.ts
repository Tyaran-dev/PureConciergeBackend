import { destinations } from "../data/destinations.js";

export function attachDestinationMeta(
  countryCode: string,
  city: string
) {
  const destination = destinations.find(
    d =>
      d.country === countryCode &&
      d.city.toLowerCase() === city.toLowerCase()
  );

  if (!destination) {
    console.log(countryCode, city,"search for destnaion")
    return null;
  }

  return {
    lat: destination.lat,
    lng: destination.lng,
    image: destination.image,
  };
}