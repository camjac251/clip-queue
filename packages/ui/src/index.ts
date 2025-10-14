// Styles
import './styles/tailwind.css'

// ShadCN UI Components
export { Button } from './components/ui/button'
export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from './components/ui/card'
export { Badge } from './components/ui/badge'
export { Input } from './components/ui/input'
export { Textarea } from './components/ui/textarea'
export { Checkbox } from './components/ui/checkbox'
export { Switch } from './components/ui/switch'
export { Label } from './components/ui/label'
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './components/ui/select'
export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from './components/ui/dialog'
export { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'
export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './components/ui/dropdown-menu'
export { Slider as SliderRaw } from './components/ui/slider'
export { default as Slider } from './components/SliderInput.vue'
export { Separator } from './components/ui/separator'
export { ScrollArea } from './components/ui/scroll-area'
export {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from './components/ui/table'
export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from './components/ui/command'
export { Toaster } from './components/ui/sonner'
export { toast } from 'vue-sonner'

// Data Table
export { default as DataTable } from './components/data-table/DataTable.vue'

// Additional Components
export { default as Message } from './components/Message.vue'
export { default as Chip } from './components/Chip.vue'
export { default as InputText } from './components/InputText.vue'
export { default as InputNumber } from './components/InputNumber.vue'

// PrimeVue compatibility (temporary during migration)
export { DropdownMenu as Menu } from './components/ui/dropdown-menu'
export { TabsTrigger as Tab, TabsList as TabList } from './components/ui/tabs'

export { default as ToggleSwitch } from './components/ToggleSwitch.vue'
export { default as MultiSelect } from './components/MultiSelect.vue'

// Test compatibility exports (mocked in tests)
export const ConfirmationService = {}
export const ToastService = {}

// TODO: These need proper implementations
// export { default as Column } from './components/Column.vue'

// Custom Components
export { default as ThemeToggle } from './custom/AppThemeToggle.vue'
export { default as GlobalConfirmDialog } from './components/GlobalConfirmDialog.vue'

// Composables
export { useConfirm } from './composables/use-confirm'
export { useToast } from './composables/use-toast'

// Utilities
export { cn } from './lib/utils'

// Icons
export * from './icons'
