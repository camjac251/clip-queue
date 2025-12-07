<!-- eslint-disable -->
<script setup lang="ts" generic="TData">
import type { ColumnDef, RowSelectionState, SortingState } from '@tanstack/vue-table'
import {
  FlexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useVueTable
} from '@tanstack/vue-table'
import { computed, ref } from 'vue'

import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'

const props = withDefaults(
  defineProps<{
    data: TData[]
    columns: ColumnDef<TData, any>[]
    paginator?: boolean
    rows?: number
    rowsPerPageOptions?: number[]
    exportFilename?: string
    class?: string
  }>(),
  {
    paginator: false,
    rows: 10,
    rowsPerPageOptions: () => [10, 20, 30, 50],
    exportFilename: 'export.csv'
  }
)

const sorting = ref<SortingState>([])
const rowSelection = ref<RowSelectionState>({})
const pageSize = ref(props.rows)

const table = useVueTable({
  get data() {
    return props.data
  },
  get columns() {
    return props.columns
  },
  state: {
    get sorting() {
      return sorting.value
    },
    get rowSelection() {
      return rowSelection.value
    },
    get pagination() {
      return {
        pageIndex: 0,
        pageSize: pageSize.value
      }
    }
  },
  onSortingChange: (updaterOrValue) => {
    sorting.value =
      typeof updaterOrValue === 'function' ? updaterOrValue(sorting.value) : updaterOrValue
  },
  onRowSelectionChange: (updaterOrValue) => {
    rowSelection.value =
      typeof updaterOrValue === 'function' ? updaterOrValue(rowSelection.value) : updaterOrValue
  },
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getPaginationRowModel: props.paginator ? getPaginationRowModel() : undefined
})

const selectedRows = computed(() => table.getSelectedRowModel().rows.map((row) => row.original))

function exportCSV() {
  const columnsWithAccessor = props.columns.filter(
    (col) => 'accessorKey' in col && col.accessorKey
  ) as Array<ColumnDef<TData, any> & { accessorKey: keyof TData }>

  const headers = columnsWithAccessor
    .map((col) =>
      'header' in col && typeof col.header === 'string' ? col.header : String(col.accessorKey)
    )
    .join(',')

  const rows = props.data
    .map((row) => {
      return columnsWithAccessor
        .map((col) => {
          const value = row[col.accessorKey]
          const stringValue = String(value ?? '')
          return stringValue.includes(',') ? `"${stringValue}"` : stringValue
        })
        .join(',')
    })
    .join('\n')

  const csv = `${headers}\n${rows}`
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = props.exportFilename
  link.click()
  URL.revokeObjectURL(url)
}

defineExpose({ exportCSV, table, selectedRows })
</script>

<template>
  <div :class="cn('space-y-4', props.class)">
    <slot name="header" />

    <div class="border-border rounded-md border">
      <Table>
        <TableHeader>
          <TableRow
            v-for="headerGroup in table.getHeaderGroups()"
            :key="headerGroup.id"
            class="border-border bg-muted/50 border-b"
          >
            <TableHead
              v-for="header in headerGroup.headers"
              :key="header.id"
              :class="
                cn(
                  'text-muted-foreground px-4 py-3 text-left text-sm font-medium',
                  header.column.getCanSort() && 'hover:bg-muted cursor-pointer select-none'
                )
              "
              @click="header.column.getToggleSortingHandler()?.($event)"
            >
              <div class="flex items-center gap-2">
                <FlexRender
                  v-if="!header.isPlaceholder"
                  :render="header.column.columnDef.header"
                  :props="header.getContext()"
                />
                <span v-if="header.column.getCanSort()" class="text-xs opacity-50">
                  {{
                    header.column.getIsSorted() === 'asc'
                      ? '↑'
                      : header.column.getIsSorted() === 'desc'
                        ? '↓'
                        : '↕'
                  }}
                </span>
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="table.getRowModel().rows.length">
            <TableRow
              v-for="row in table.getRowModel().rows"
              :key="row.id"
              class="border-border hover:bg-muted/50 border-b transition-colors"
            >
              <TableCell
                v-for="cell in row.getVisibleCells()"
                :key="cell.id"
                class="text-foreground px-4 py-3 text-sm"
              >
                <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
              </TableCell>
            </TableRow>
          </template>
          <template v-else>
            <TableRow>
              <TableCell :colspan="table.getAllColumns().length" class="h-24 text-center">
                <slot name="empty">
                  <div class="text-muted-foreground p-4">No data</div>
                </slot>
              </TableCell>
            </TableRow>
          </template>
        </TableBody>
      </Table>
    </div>

    <div v-if="paginator" class="flex items-center justify-between px-2">
      <div class="flex items-center gap-2">
        <span class="text-muted-foreground text-sm">Rows per page:</span>
        <Select
          :model-value="pageSize.toString()"
          @update:model-value="
            (value) => {
              pageSize = Number(value)
              table.setPageSize(Number(value))
            }
          "
        >
          <SelectTrigger class="h-8 w-[70px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="size in rowsPerPageOptions" :key="size" :value="size.toString()">
              {{ size }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="flex items-center gap-2">
        <span class="text-muted-foreground text-sm">
          Page {{ table.getState().pagination.pageIndex + 1 }} of {{ table.getPageCount() }}
        </span>
        <div class="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            :disabled="!table.getCanPreviousPage()"
            @click="table.previousPage()"
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            :disabled="!table.getCanNextPage()"
            @click="table.nextPage()"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
