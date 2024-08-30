import React, {useState} from 'react'
import { toast } from '../ui/use-toast';

export default function EditProduct({product, onEditSuccess, isEditing, handleEditState}) {
    const [name, setName] = useState(product.name);
    const [quantity, setQuantity] = useState(product.quantity)
    const [unit, setUnit] = useState(product.unit);
    const [unitPrice, setUnitPrice] = useState(product.unitPrice);
    const [stock, setStock] = useState(product.stock);
    const [status, setStatus] = useState(product.status)

    const handleInputs = {
        handleName: (value) => setName(value),
        handleQuantity: (value) => setQuantity(value),
        handleUnit: (value) => setUnit(value),
        handleUnitPrice: (value) => setUnitPrice(value),
        handleStock: (value) => setStock(value),
        handleStatus: (value) => setStatus(value)
    };

    const handleEditing = async (e) => {
        try {
          const editFields = {
              _id: product._id,
              name: name,
              quantity: quantity,
              unit: unit,
              unitPrice: parseInt(unitPrice),
              stock: parseInt(stock),
              status: status
          }
          console.log(editFields);
          const result = await window.electronAPI.realmOperation('updateProduct', editFields);
          if (result.success) {
            toast({
              title: "Success",
              description: "Product updated successfully!",
            });
            onEditSuccess();
            handleEditState();
          } else {
            throw new Error(result.error);
          }
        } catch (error) {
          console.error('Error updating product:', error);
          toast({
            title: "Error",
            description: "Failed to update product. Please try again.",
            variant: "destructive",
          });
        }
      };

  return (
    <div>
        <div>
            <div>Name</div>
            <input type="text" value={name} onChange={(e) => {handleInputs.handleName(e.target.value)}} />
        </div>
        <div>
            <div>Quantity</div>
            <input type="number" value={quantity} onChange={(e) => {handleInputs.handleQuantity(e.target.value)}} />
        </div>
        <div>
            <div>Unit</div>
            <input type="text" value={unit} onChange={(e) => {handleInputs.handleUnit(e.target.value)}} />
        </div>
        <div>
            <div>Unit Price</div>
            <input type="number" value={unitPrice} onChange={(e) => {handleInputs.handleUnitPrice(e.target.value)}} />
        </div>
        <div>
            <div>Stock</div>
            <input type="text" value={stock} onChange={(e) => {handleInputs.handleStock(e.target.value)}} />
        </div>
        <div>
            <div>Status</div>
            <select name="status" value={status}>
                <option value="In Stock">In Stock</option>
                <option value="Out Stock">Out Stock</option>
                <option value="Archived">Archived</option>
            </select>
        </div>
        <div>
            <button>Cancel</button>
            <button onClick={handleEditing} >Update</button>
        </div>
    </div>
  )
}
