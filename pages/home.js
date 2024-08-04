import { useState, useEffect } from 'react';

export default function Home() {
  const [customers, setCustomers] = useState([]);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phoneNumber: '',
    address: '',
    balance: 0,
    credit: false
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  async function fetchCustomers() {
    const response = await fetch('/api/customers');
    const data = await response.json();
    setCustomers(data);
  }

  async function createCustomer(e) {
    e.preventDefault();
    await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCustomer),
    });
    setNewCustomer({
      name: '',
      phoneNumber: '',
      address: '',
      balance: 0,
      credit: false
    });
    fetchCustomers();
  }

  async function updateCustomer(id, updatedData) {
    await fetch('/api/customers', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _id: id, ...updatedData }),
    });
    fetchCustomers();
  }

  async function deleteCustomer(id) {
    await fetch('/api/customers', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _id: id }),
    });
    fetchCustomers();
  }

  return (
    <div>
      <h1>Customer Manager</h1>
      <form onSubmit={createCustomer}>
        <input
          type="text"
          value={newCustomer.name}
          onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
          placeholder="Name"
          required
        />
        <input
          type="tel"
          value={newCustomer.phoneNumber}
          onChange={(e) => setNewCustomer({...newCustomer, phoneNumber: e.target.value})}
          placeholder="Phone Number"
          required
        />
        <input
          type="text"
          value={newCustomer.address}
          onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})}
          placeholder="Address"
          required
        />
        <input
          type="number"
          value={newCustomer.balance}
          onChange={(e) => setNewCustomer({...newCustomer, balance: parseInt(e.target.value)})}
          placeholder="Balance"
          required
        />
        <label>
          <input
            type="checkbox"
            checked={newCustomer.credit}
            onChange={(e) => setNewCustomer({...newCustomer, credit: e.target.checked})}
          />
          Credit
        </label>
        <button type="submit">Add Customer</button>
      </form>
      <ul>
        {customers.map((customer) => (
          <li key={customer._id}>
            {customer.name} - {customer.phoneNumber} - Balance: {customer.balance} - Credit: {customer.credit ? 'Yes' : 'No'}
            <button onClick={() => updateCustomer(customer._id, { ...customer, balance: customer.balance + 100 })}>Add $100</button>
            <button onClick={() => deleteCustomer(customer._id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}