// Invented sample data for the demo: generic, well-known parts. Nothing here comes from a real inventory.
import type { Part } from '../api/types'
import type { Category } from '../lib/tree'

export type StoredPart = Omit<Part, 'label' | 'fuzzy'> & { barcode: string; folder_hint: string }

export interface DemoData {
  nextId: number // one counter for every id
  categories: Category[]
  parts: StoredPart[]
  boms: { id: number; name: string }[]
  bomItems: { bom_id: number; part_id: number; qty: number }[]
  projects: { id: number; name: string; file_name: string; loss_pct: number | null }[]
  projectLines: { project_id: number; line: number; mpn: string; manufacturer: string; supplier_pn: string
    description: string; designators: string; qty_per_board: number }[]
  builds: { id: number; request_id: string; project_id: number | null; project_name: string; boards: number
    loss_pct: number; created_at: string }[]
  buildItems: { build_id: number; part_id: number | null; mpn: string; qty: number }[]
}

// folder path ["A", "B"] -> category id, creating missing levels
export function ensurePath(d: DemoData, names: string[]): number | null {
  let parent: number | null = null
  for (const name of names) {
    let c = d.categories.find(x => x.parent_id === parent && x.name === name)
    if (!c) d.categories.push(c = { id: d.nextId++, parent_id: parent, name })
    parent = c.id
  }
  return parent
}

const R = (ohms: string) => ({ Resistance: ohms, Tolerance: '±1%', Power: '0.1 W', Package: '0603' })
const C = (cap: string, volts: string, dielectric: string, pkg: string) => ({ Capacitance: cap, Voltage: volts, Dielectric: dielectric, Package: pkg })

// [folder, mpn, manufacturer, description, qty, location, attrs]
const PARTS: [string, string, string, string, number, string, Record<string, string>][] = [
  ['Resistors / SMD 0603', 'RC0603FR-0710KL', 'YAGEO', 'RES 10K OHM 1% 1/10W 0603', 4800, 'Reel rack 1', R('10 kΩ')],
  ['Resistors / SMD 0603', 'RC0603FR-07220RL', 'YAGEO', 'RES 220 OHM 1% 1/10W 0603', 2500, 'Reel rack 1', R('220 Ω')],
  ['Resistors / SMD 0603', 'RC0603FR-071KL', 'YAGEO', 'RES 1K OHM 1% 1/10W 0603', 3900, 'Reel rack 1', R('1 kΩ')],
  ['Resistors / SMD 0603', 'RC0603FR-074K7L', 'YAGEO', 'RES 4.7K OHM 1% 1/10W 0603', 1800, 'Reel rack 1', R('4.7 kΩ')],
  ['Resistors / SMD 0603', 'RC0603FR-07100KL', 'YAGEO', 'RES 100K OHM 1% 1/10W 0603', 2200, 'Reel rack 1', R('100 kΩ')],
  ['Capacitors / Ceramic', 'CL10B104KB8NNNC', 'Samsung', 'CAP CER 0.1UF 50V X7R 0603', 8000, 'Reel rack 2', C('100 nF', '50 V', 'X7R', '0603')],
  ['Capacitors / Ceramic', 'CL21A106KAYNNNC', 'Samsung', 'CAP CER 10UF 25V X5R 0805', 1500, 'Reel rack 2', C('10 µF', '25 V', 'X5R', '0805')],
  ['Capacitors / Ceramic', 'GRM188R71H103KA01D', 'Murata', 'CAP CER 10000PF 50V X7R 0603', 3000, 'Reel rack 2', C('10 nF', '50 V', 'X7R', '0603')],
  ['Capacitors / Ceramic', 'CL10C220JB8NNNC', 'Samsung', 'CAP CER 22PF 50V C0G 0603', 2000, 'Reel rack 2', C('22 pF', '50 V', 'C0G', '0603')],
  ['Capacitors / Electrolytic', 'EEE-FK1C470P', 'Panasonic', 'CAP ALUM 47UF 20% 16V SMD', 60, 'Drawer B1', { Capacitance: '47 µF', Voltage: '16 V', Package: 'SMD 6.3 mm' }],
  ['Capacitors / Electrolytic', 'EEE-FK1V101P', 'Panasonic', 'CAP ALUM 100UF 20% 35V SMD', 25, 'Drawer B1', { Capacitance: '100 µF', Voltage: '35 V', Package: 'SMD 8 mm' }],
  ['Capacitors / Electrolytic', 'UVR1E471MPD', 'Nichicon', 'CAP ALUM 470UF 20% 25V RADIAL', 8, 'Drawer B1', { Capacitance: '470 µF', Voltage: '25 V', Package: 'Radial 10 mm' }],
  ['ICs / Microcontrollers', 'ESP32-S3-WROOM-1-N8R8', 'Espressif', 'RX TXRX MOD WIFI BT 8MB FLASH 8MB PSRAM', 6, 'Drawer A3', { Core: 'Xtensa LX7 dual-core', Flash: '8 MB', PSRAM: '8 MB', Radio: 'Wi-Fi + BLE 5' }],
  ['ICs / Microcontrollers', 'ATMEGA328P-AU', 'Microchip Technology', 'IC MCU 8BIT 32KB FLASH 32TQFP', 35, 'Drawer A3', { Core: 'AVR', Flash: '32 KB', Package: 'TQFP-32' }],
  ['ICs / Microcontrollers', 'RP2040', 'Raspberry Pi', 'IC MCU 32BIT ROMLESS 56QFN', 120, 'Drawer A3', { Core: 'Dual Cortex-M0+', SRAM: '264 KB', Package: 'QFN-56' }],
  ['ICs / Power', 'AMS1117-3.3', 'Advanced Monolithic Systems', 'IC REG LINEAR 3.3V 1A SOT223', 140, 'Drawer A4', { Output: '3.3 V', Current: '1 A', Package: 'SOT-223' }],
  ['ICs / Power', 'LM2596S-5.0', 'Texas Instruments', 'IC REG BUCK 5V 3A TO263-5', 3, 'Drawer A4', { Output: '5 V', Current: '3 A', Package: 'TO-263-5' }],
  ['ICs / Power', 'MCP1700T-3302E/TT', 'Microchip Technology', 'IC REG LINEAR 3.3V 250MA SOT23-3', 90, 'Drawer A4', { Output: '3.3 V', Current: '250 mA', Package: 'SOT-23-3' }],
  ['Diodes', '1N4148W-7-F', 'Diodes Incorporated', 'DIODE GEN PURP 100V 300MA SOD123', 1000, 'Reel rack 2', { Voltage: '100 V', Current: '300 mA', Package: 'SOD-123' }],
  ['Connectors', 'USB4105-GF-A', 'GCT', 'USB-C RECEPTACLE 16POS SMD', 45, 'Drawer C1', { Type: 'USB Type-C', Positions: '16', Mounting: 'SMD' }],
  ['Connectors', 'S2B-PH-K-S', 'JST', 'CONN HEADER R/A 2POS 2MM', 200, 'Drawer C1', { Series: 'PH', Positions: '2', Pitch: '2 mm' }],
  ['Connectors', 'B4B-PH-K-S', 'JST', 'CONN HEADER VERT 4POS 2MM', 150, 'Drawer C1', { Series: 'PH', Positions: '4', Pitch: '2 mm' }],
  ['Connectors', 'PPTC401LFBN-RC', 'Sullins Connector Solutions', 'CONN HDR 40POS 0.1 TIN PCB', 30, 'Drawer C2', { Positions: '40', Pitch: '2.54 mm' }],
  ['LEDs', 'LTST-C191KRKT', 'Lite-On', 'LED RED CLEAR 0603 SMD', 900, 'Drawer C3', { Color: 'Red', Package: '0603' }],
  ['LEDs', 'LTST-C191KGKT', 'Lite-On', 'LED GREEN CLEAR 0603 SMD', 0, 'Drawer C3', { Color: 'Green', Package: '0603' }],
  ['LEDs', 'WS2812B-2020', 'Worldsemi', 'LED RGB ADDRESSABLE 2020 SMD', 400, 'Drawer C3', { Color: 'RGB', Package: '2020' }],
  ['Switches', 'B3F-1000', 'Omron', 'SWITCH TACTILE SPST-NO 0.05A 24V', 120, 'Drawer C4', { Type: 'Tactile', Mounting: 'THT' }],
  ['Switches', 'PTS645SM43SMTR92 LFS', 'C&K', 'SWITCH TACTILE SPST-NO 0.05A 12V', 500, 'Drawer C4', { Type: 'Tactile', Mounting: 'SMD' }],
  ['Switches', 'PEC11R-4215F-S0024', 'Bourns', 'ROTARY ENCODER MECHANICAL 24PPR', 80, 'Drawer C4', { Type: 'Encoder', Pulses: '24 PPR' }],
]

// Demo MIDI controller BOM: [mpn, manufacturer, description, designators, per board]
const LINES: [string, string, string, string, number][] = [
  ['ESP32-S3-WROOM-1-N8R8', 'Espressif', 'Wi-Fi/BLE module', 'U1', 1],
  ['AMS1117-3.3', 'Advanced Monolithic Systems', '3.3 V regulator', 'U2', 1],
  ['USB4105-GF-A', 'GCT', 'USB-C receptacle', 'J1', 1],
  ['6N138', 'Lite-On', 'Optocoupler, MIDI in', 'U3', 1], // not in stock: added in the BOM revision after the first build
  ['RC0603FR-0710KL', 'YAGEO', '10k 0603', 'R1, R2, R3, R4, R5, R6, R7, R8', 8],
  ['RC0603FR-07220RL', 'YAGEO', '220R 0603', 'R9, R10, R11, R12, R13, R14', 6],
  ['CL10B104KB8NNNC', 'Samsung', '100n 0603', 'C1, C2, C3, C4, C5, C6, C7, C8, C9, C10', 10],
  ['CL21A106KAYNNNC', 'Samsung', '10u 0805', 'C11, C12', 2],
  ['EEE-FK1C470P', 'Panasonic', '47u electrolytic', 'C13', 1],
  ['B3F-1000', 'Omron', 'Tactile switch', 'SW1, SW2, SW3, SW4', 4],
  ['LTST-C191KRKT', 'Lite-On', 'Red LED', 'D1, D2, D3, D4', 4],
  ['PEC11R-4215F-S0024', 'Bourns', 'Rotary encoder', 'ENC1, ENC2, ENC3, ENC4', 4],
]

// Restock — next order: [mpn, qty to order]
const REORDER: [string, number][] = [['ESP32-S3-WROOM-1-N8R8', 10], ['LM2596S-5.0', 5], ['LTST-C191KGKT', 200]]

export function seedData(): DemoData {
  const d: DemoData = { nextId: 1, categories: [], parts: [], boms: [], bomItems: [], projects: [], projectLines: [], builds: [], buildItems: [] }
  for (const [folder, mpn, manufacturer, description, qty, location, attrs] of PARTS) {
    const category_id = ensurePath(d, folder.split(' / '))
    d.parts.push({ id: d.nextId++, status: 'saved', mpn, manufacturer, source: 'manual', dist_pn: '', description, category_id,
      folder_hint: '', qty, location, datasheet_url: '', image_url: '', barcode: '', attrs })
  }
  const partId = (mpn: string) => d.parts.find(p => p.mpn === mpn)?.id ?? null

  const bom = { id: d.nextId++, name: 'Restock — next order' }
  d.boms.push(bom)
  for (const [mpn, qty] of REORDER) d.bomItems.push({ bom_id: bom.id, part_id: partId(mpn)!, qty })

  const project = { id: d.nextId++, name: 'Demo MIDI controller', file_name: 'demo-midi-controller.csv', loss_pct: 0 }
  d.projects.push(project)
  LINES.forEach(([mpn, manufacturer, description, designators, qty_per_board], i) => d.projectLines.push(
    { project_id: project.id, line: i + 1, mpn, manufacturer, supplier_pn: '', description, designators, qty_per_board }))

  // one past build of 2 boards; the stock above is what was left after it
  const build = { id: d.nextId++, request_id: 'seed-build-0001', project_id: project.id, project_name: project.name,
    boards: 2, loss_pct: 0, created_at: '2026-10-01T14:00:00.000Z' }
  d.builds.push(build)
  for (const [mpn, , , , perBoard] of LINES) {
    const part_id = partId(mpn)
    if (part_id) d.buildItems.push({ build_id: build.id, part_id, mpn, qty: perBoard * 2 })
  }
  return d
}
