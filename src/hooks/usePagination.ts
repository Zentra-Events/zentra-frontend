import type { PaginationInfo } from "@/components/ui";
import { useMemo, useState } from "react";

export function usePagination({
    totalPages,
    pageSize,
    totalElements,
    itemName,
}: {
    totalPages: number;
    pageSize: number;
    totalElements: number;
    itemName?: string;
}) {
    const [currentPage, setCurrentPage] = useState(1);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const pagination: PaginationInfo = useMemo(() => {
        return {
            currentPage,
            totalPages,
            pageSize: pageSize,
            totalItems: totalElements,
            itemName: itemName,
            hasNextPage: currentPage < totalPages,
            hasPreviousPage: currentPage > 1,
        };
    }, [currentPage, totalPages, totalElements]);

    return { currentPage, pagination, handlePageChange, setCurrentPage };
}
