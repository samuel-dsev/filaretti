export function officeAddress(address: Record<string, string>): string {
  const city = [address.city, address.state].filter(Boolean).join('/');
  const location = [address.street, city].filter(Boolean).join(', ');
  return [location, address.postalCode && `CEP ${address.postalCode}`].filter(Boolean).join(' ');
}
