import { useState } from 'react';
import { useRouter } from 'next/router';
import useWsinfoStore from '@/stores/wsinfo';

export default function WsSignin() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const router = useRouter();
  const addWsinfo = useWsinfoStore((state) => state.addWsinfo);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Here you would typically make an API call to verify the workspace info
    // For now, we'll just add it to the store
    addWsinfo({ name, phone, location });
    router.push('/');
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="px-8 py-6 mt-4 text-left bg-white shadow-lg">
        <h3 className="text-2xl font-bold text-center">Workspace Sign In</h3>
        <form onSubmit={handleSubmit}>
          <div className="mt-4">
            <div>
              <label className="block" htmlFor="name">Workspace Name</label>
              <input type="text" placeholder="Name" id="name"
                className="w-full px-4 py-2 mt-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600"
                value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="mt-4">
              <label className="block" htmlFor="phone">Phone</label>
              <input type="tel" placeholder="Phone" id="phone"
                className="w-full px-4 py-2 mt-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600"
                value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
            <div className="mt-4">
              <label className="block" htmlFor="location">Location</label>
              <input type="text" placeholder="Location" id="location"
                className="w-full px-4 py-2 mt-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600"
                value={location} onChange={(e) => setLocation(e.target.value)} required />
            </div>
            <div className="flex items-baseline justify-between">
              <button type="submit" className="px-6 py-2 mt-4 text-white bg-blue-600 rounded-lg hover:bg-blue-900">Sign In</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
