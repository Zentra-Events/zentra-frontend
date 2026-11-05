export interface Inventory {
    id?: string
    itemName: string
    category: string
    subCategory?: string
    spec: string
    dimensions: string
    quantity: number
    price: number
}

export interface InventoryFormData {
    id?: string
    itemName: string
    category: string
    subCategory?: string
    spec: string
    dimensions: string
    quantity: number | string
    price: number | string
}

export interface InventoryUsage {
    id?: string
    inventoryId?: string
    projectID?: string
    projectId?: string
    fromDate?: string
    toDate?: string
    quantity?: number
    [key: string]: unknown
}

export interface CreateInventoryModalProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: () => void
    editData?: InventoryFormData | null
    mode?: 'create' | 'edit'
}
