import { ReactNode } from "react";
import { Card } from "../ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import PaginationDataTable from "./pagination-data-table";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { LIMIT_LISTS } from "@/constants/data-table-constant";

export default function DataTable({
  header,
  data,
  isLoading,
  totalPages,
  currentPage,
  currentLimit,
  onChangePage,
  onChangeLimit,
}: {
  header: string[];
  data: (string | ReactNode)[][];
  isLoading?: boolean;
  totalPages: number;
  currentPage: number;
  currentLimit: number;
  onChangePage: (page: number) => void;
  onChangeLimit: (limit: number) => void;
}) {
  return (
    <div className="w-full flex flex-col gap-4">
      <Card className="p-0">
        <Table className="w-full rounded-lg overflow-hidden">
          <TableHeader className="bg-muted sticky top-0 z-10">
            <TableRow>
              {header.map((column) => (
                <TableHead key={`th-${column}`} className="px-6 py-3">
                  {column}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map((row, rowIndex) => (
              <TableRow key={`tr-${rowIndex}`}>
                {row.map((column, columnIndex) => (
                  <TableCell
                    className="px-6 py-3"
                    key={`tc-${rowIndex}-${columnIndex}`}
                  >
                    {column}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {data?.length === 0 && !isLoading && (
              <TableRow>
                <TableCell colSpan={header.length} className="h-24 text-center">
                  No Result Data
                </TableCell>
              </TableRow>
            )}
            {isLoading && (
              <TableRow>
                <TableCell colSpan={header.length} className="h-24 text-center">
                  Loading...
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
      {/* FIX: dulu "Limit" di kiri dan pagination di kanan dalam satu row
          `justify-between` — karena div pagination tidak melebar penuh,
          pagination jadi nempel ke kanan/tengah-kanan, bukan benar-benar
          di tengah. Sekarang pakai grid 3 kolom: kolom tengah SELALU di
          tengah dari lebar penuh baris, terlepas dari lebar kontrol Limit
          di kiri. */}
      <div className="grid grid-cols-3 items-center gap-4">
        <div className="flex items-center gap-2 justify-self-start">
          <Label>Limit</Label>
          <Select
            value={currentLimit.toString()}
            onValueChange={(value) => onChangeLimit(Number(value))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Limit" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Limit</SelectLabel>
                {LIMIT_LISTS.map((limit) => (
                  <SelectItem key={limit} value={limit.toString()}>
                    {limit}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="justify-self-center">
          {totalPages > 1 && (
            <PaginationDataTable
              currentPage={currentPage}
              onChangePage={onChangePage}
              totalPages={totalPages}
            />
          )}
        </div>
        <div />
      </div>
    </div>
  );
}
