import { useState } from 'react';

export default function Home() {
  const [newCustomer, setNewCustomer] = useState(null);
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(0);
  const [address, setAddress] = useState('');
  const [balance, setBalance] = useState(0);
  const [credit, setCredit] = useState(false);
  const [disciplinary, setDisciplinary] = useState('Neutral');

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setCredit(checked);
    } else {
      switch (name) {
        case 'name':
          setName(value);
          break;
        case 'phoneNumber':
          setPhoneNumber(value);
          break;
        case 'address':
          setAddress(value);
          break;
        case 'balance':
          setBalance(value);
          break;
        case 'disciplinary':
          setDisciplinary(value);
          break;
        default:
          break;
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const customerData = {
      name: name,
      phoneNumber: parseInt(phoneNumber),
      address: address,
      balance: parseInt(balance),
      credit: credit,
      disciplinery: disciplinary
    }
    console.log(customerData)
    try {
      const result = await window.electronAPI.realmOperation('createCustomer', customerData);
      if (result.success) {
        alert('Customer created successfully!');
        setNewCustomer(result.customer);
        // Clear the input fields
        setName('');
        setPhoneNumber(0);
        setAddress('');
        setBalance(0);
        setCredit(false);
        setDisciplinary('Neutral');
      } else {
        console.error('Error creating customer:', result.error);
      }
    } catch (error) {
      console.error('Error creating customer:', error);
      alert('Failed to create customer. Please try again.');
    }
  };

  console.log(newCustomer)

  return (
    <div>
      <h1>Create New Customer</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="name">Name:</label>
          <input
            type="text"
            id="name"
            name="name"
            value={name}
            onChange={handleInputChange}
            required
          />
        </div>
        <div>
          <label htmlFor="phoneNumber">Phone:</label>
          <input
            type="number"
            id="phoneNumber"
            name="phoneNumber"
            value={phoneNumber}
            onChange={handleInputChange}
            required
          />
        </div>
        <div>
          <label htmlFor="address">Address:</label>
          <input
            type="text"
            id="address"
            name="address"
            value={address}
            onChange={handleInputChange}
            required
          />
        </div>
        <div>
          <label htmlFor="balance">Balance:</label>
          <input
            type="number"
            id="balance"
            name="balance"
            value={balance}
            onChange={handleInputChange}
          />
        </div>
        <div>
          <label htmlFor="credit">Credit:</label>
          <input
            type="checkbox"
            id="credit"
            name="credit"
            checked={credit}
            onChange={handleInputChange}
          />
        </div>
        <div>
          <label htmlFor="disciplinary">Disciplinary Status:</label>
          <select
            id="disciplinary"
            name="disciplinary"
            value={disciplinary}
            onChange={handleInputChange}
          >
            <option value="Neutral">Neutral</option>
            <option value="Good">Good</option>
            <option value="Bad">Bad</option>
          </select>
        </div>
        <button type="submit">Create Customer</button>
      </form>
    </div>
  );
}
