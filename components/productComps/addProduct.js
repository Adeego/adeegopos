import React, { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import useWsinfoStore from "@/stores/wsinfo";

export default function AddProduct({ fetchProducts }) {
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const wsinfo = useWsinfoStore((state) => state.wsinfo);

  // Updated product state
  const [newProduct, setNewProduct] = useState({
    _id: "",
    name: "",
    baseUnit: "",
    buyPrice: "",
    stock: "",
    status: "",
    category: "",
    restockThreshold: "",
    restockPeriod: "",
    barCode: "",
    variants: [], // Array to hold product variants
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const [newVariant, setNewVariant] = useState({
    _id: "",
    name: "",
    conversionFactor: "",
    unitPrice: "",
  });

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    setNewProduct((prev) => ({
      ...prev,
      [name]: type === "number" ? parseFloat(value) : value,
    }));
  };

  const handleVariantChange = (e) => {
    const { name, value } = e.target;
    setNewVariant((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const addVariant = () => {
    setNewProduct((prev) => ({
      ...prev,
      variants: [
        ...prev.variants,
        {
          ...newVariant,
          _id: `${wsinfo.storeNo}:${uuidv4()}`,
          storeNo: wsinfo.storeNo,
          conversionFactor: parseFloat(newVariant.conversionFactor),
          unitPrice: parseFloat(newVariant.unitPrice),
        },
      ],
    }));
    setNewVariant({
      _id: "",
      name: "",
      conversionFactor: "",
      unitPrice: "",
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsAddingProduct(true);
    try {
      const productData = {
        ...newProduct,
        _id: `${wsinfo.storeNo}:${uuidv4()}`,
        storeNo: wsinfo.storeNo,
        buyPrice: parseFloat(newProduct.buyPrice),
        stock: parseFloat(newProduct.stock),
        restockThreshold: parseInt(newProduct.restockThreshold, 10),
        restockPeriod: parseInt(newProduct.restockPeriod, 10),
        variants: newProduct.variants, // Include the variants
      };
      console.log(productData);
      const result = await window.electronAPI.realmOperation(
        "addNewProduct",
        productData,
      );
      if (result.success) {
        toast({
          title: "Success",
          description: "Product created successfully!",
        });
        fetchProducts(); // Refresh the product list
        setNewProduct({
          __id: "",
          name: "",
          baseUnit: "",
          buyPrice: "",
          stock: "",
          status: "",
          category: "",
          restockThreshold: "",
          restockPeriod: "",
          barCode: "",
          variants: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          storeNo: wsinfo.storeNo,
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Error creating product:", error);
      toast({
        title: "Error",
        description: "Failed to create product. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAddingProduct(false);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Add Product</Button>
      </SheetTrigger>
      <SheetContent className="xl:max-w-[500px]">
        <ScrollArea className="h-[97vh] rounded-md border p-4 overscroll-none">
          <SheetHeader>
            <SheetTitle>Add New Product</SheetTitle>
            <SheetDescription>
              Fill in the details to add a new product.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              {/* Product input fields (name, baseUnit, etc.) */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input
                  id="name"
                  name="name"
                  value={newProduct.name}
                  onChange={handleInputChange}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="baseUnit" className="text-right">
                  Base Unit
                </Label>
                <Input
                  id="baseUnit"
                  name="baseUnit"
                  value={newProduct.baseUnit}
                  onChange={handleInputChange}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="buyPrice" className="text-right">
                  Buy Price
                </Label>
                <Input
                  id="buyPrice"
                  name="buyPrice"
                  type="number"
                  value={newProduct.buyPrice}
                  onChange={handleInputChange}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="stock" className="text-right">
                  Stock
                </Label>
                <Input
                  id="stock"
                  name="stock"
                  type="number"
                  value={newProduct.stock}
                  onChange={handleInputChange}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status" className="text-right">
                  Status
                </Label>
                <Select
                  name="status"
                  value={newProduct.status}
                  onValueChange={(value) =>
                    setNewProduct((prev) => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Archived">Archived</SelectItem>
                    <SelectItem value="In Stock">In Stock</SelectItem>
                    <SelectItem value="Out Of Stock">Out Of Stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="category" className="text-right">
                  Category
                </Label>
                <Input
                  id="category"
                  name="category"
                  value={newProduct.category}
                  onChange={handleInputChange}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="restockThreshold" className="text-right">
                  Restock Threshold
                </Label>
                <Input
                  id="restockThreshold"
                  name="restockThreshold"
                  type="number"
                  value={newProduct.restockThreshold}
                  onChange={handleInputChange}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="restockPeriod" className="text-right">
                  Restock Period (Days)
                </Label>
                <Input
                  id="restockPeriod"
                  name="restockPeriod"
                  type="number"
                  value={newProduct.restockPeriod}
                  onChange={handleInputChange}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="sku" className="text-right">
                  SKU
                </Label>
                <Input
                  id="sku"
                  name="sku"
                  value={newProduct.sku}
                  onChange={handleInputChange}
                  className="col-span-3"
                />
              </div>

              {/* Variant Input Section */}
              <div className="py-4">
                <h4 className="font-semibold">Add Product Variant</h4>
                <div className="grid grid-cols-4 gap-4 items-center">
                  <Label htmlFor="variantName" className="text-right">
                    Variant Name
                  </Label>
                  <Input
                    id="variantName"
                    name="name"
                    value={newVariant.name}
                    onChange={handleVariantChange}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 gap-4 items-center">
                  <Label htmlFor="conversionFactor" className="text-right">
                    Conversion Factor
                  </Label>
                  <Input
                    id="conversionFactor"
                    name="conversionFactor"
                    type="number"
                    value={newVariant.conversionFactor}
                    onChange={handleVariantChange}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 gap-4 items-center">
                  <Label htmlFor="variantUnitPrice" className="text-right">
                    Unit Price
                  </Label>
                  <Input
                    id="variantUnitPrice"
                    name="unitPrice"
                    type="number"
                    value={newVariant.unitPrice}
                    onChange={handleVariantChange}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 gap-4 items-center">
                  <Button
                    type="button"
                    onClick={addVariant}
                    className="col-span-4"
                  >
                    Add Variant
                  </Button>
                </div>
              </div>

              {/* Displaying Added Variants */}
              {newProduct.variants.length > 0 && (
                <div>
                  <h4 className="font-semibold">Added Variants</h4>
                  <ul>
                    {newProduct.variants.map((variant) => (
                      <li key={variant._id}>
                        {variant.name} - {variant.unitPrice} (
                        {variant.conversionFactor})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <SheetFooter>
              <SheetClose>
                <Button type="submit" disabled={isAddingProduct}>
                  {isAddingProduct ? "Adding..." : "Add Product"}
                </Button>
              </SheetClose>
            </SheetFooter>
          </form>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
