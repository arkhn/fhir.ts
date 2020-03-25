import { AttributeDefinition } from './types'

const toCamelCase = (s: string) => s[0].toUpperCase() + s.slice(1)

const PRIMITIVE_TYPES = [
  'base64Binary',
  'boolean',
  'canonical',
  'code',
  'date',
  'dateTime',
  'decimal',
  'id',
  'instant',
  'integer',
  'markdown',
  'oid',
  'positiveInt',
  'string',
  'time',
  'unsignedInt',
  'uri',
  'url',
  'uuid',
  'xhtml',
]

// Attribute is the class used to represent hierarchically a FHIR resource based on its StructureDefinition.
export class Attribute {
  parent?: Attribute
  children: Attribute[]
  slices: Attribute[]
  items: Attribute[]

  id: string
  name: string
  definition: AttributeDefinition
  types: string[]

  isArray: boolean
  isSlice: boolean
  isItem: boolean
  isRequired: boolean
  isPrimitive: boolean

  index?: number

  // the Attribute class must be initialized with an AttributeDefinition, which
  // is a single item of the snapshot.element array of a StructureDefinition.
  constructor(definition: AttributeDefinition) {
    this.children = []
    this.slices = []
    this.items = []

    this.definition = definition
    this.id = definition.id.split('.').pop()!
    this.name = definition.path.split('.').pop()!
    this.isArray = definition.max === '*' || Number(definition.max) > 1
    this.isSlice = !!definition.sliceName
    this.isItem = false
    this.isRequired = definition.min > 0

    this.types = definition.type
      ? definition.type.map((type: any) => type.code)
      : []

    this.isPrimitive =
      this.types.length > 1
        ? false
        : PRIMITIVE_TYPES.includes(this.types[0])
        ? true
        : false
  }

  get isReferenceType(): boolean {
    return this.types[0] === 'uri' && this.parent?.types[0] === 'Reference'
  }

  // tail returns the last element of the attribute path
  get tail(): string {
    let tail = this.name || ''

    if (this.isSlice) {
      tail = this.name.includes('[x]') ? this.definition.sliceName : this.name
    }

    // if element has an index, return the index in brackets
    return this.isItem ? `${tail}[${this.index}]` : tail
  }

  // path returns the complete path of the attribute and its parents (if any)
  get path(): string {
    // if not parent, returns the tail
    if (!this.parent) {
      return this.tail
    }

    // else, join the parent to the current element with a '.'
    return `${this.parent.path}.${this.tail}`
  }

  // from rebuilds an Attribute from an other one or from a serialized version of it.
  // It recursively browse all the slices, children and items in order to deep copy the provided attribute.
  // This function is especially useful when we want to rebuild an
  // Attribute tree from a cached version of a StructureDefinition.
  static from(serialized: any): Attribute {
    const attr = new Attribute(serialized.definition)
    for (const child of serialized.children) {
      attr.addChild(Attribute.from(child))
    }
    for (const slice of serialized.slices) {
      attr.addSlice(Attribute.from(slice))
    }
    for (const item of serialized.items) {
      attr.addItem(Attribute.from(item))
    }
    return attr
  }

  // spreadTypes generates an array of single-type Attribute for each type of this attribute.
  // We use this in cases where we have an attrirbute like "value[x]" which has multiple types
  // and we want to generate as many children as there are types (eg: "valueQuantity", "valueBoolean"...)
  spreadTypes(): Attribute[] {
    if (this.types.length > 1) {
      return this.types.map(type => {
        const attr = new Attribute({
          ...this.definition,
          type: [{ code: type }],
          id: this.definition.id.replace('[x]', toCamelCase(type)),
          path: this.definition.path.replace('[x]', toCamelCase(type)),
        })
        this.parent?.addChild(attr)
        return attr
      })
    }
    return [this]
  }

  // addChild adds a child attribute to this and sets the child's parent to this.
  addChild(child: Attribute) {
    child.parent = this
    this.children.push(child)
  }

  // addSlice adds a slice attribute to this and update the parent of the slice with the current parent.
  // Note that if this attribute is an item of an array, the slice must be an item as well (and we pass along the current index)
  addSlice(slice: Attribute) {
    slice.parent = this.parent
    if (this.isItem) {
      slice.isItem = true
      slice.index = this.index
    }
    this.slices.push(slice)
  }

  // addItem adds an item to this and update the parent of the item with the current parent.
  // The index may be provided (in case the attribute already exists in the db and has a pre-defined index)
  // Otherwise the index is computed with the first available index.
  // If the added item has slices, we must pass along the item's index.
  addItem(item: Attribute, index?: number) {
    const computeIndex = () => {
      if (index !== undefined) {
        if (this.items.map(it => it.index).includes(index)) {
          throw new Error(`item with index ${index} already exists`)
        }
        return index
      }

      for (let i = 0; i <= this.items.length; i++) {
        if (!this.items.map(it => it.index).includes(i)) return i
      }
      return this.items.length
    }

    item.parent = this.parent
    item.isItem = true
    item.index = index !== undefined ? index : computeIndex()
    item.slices.forEach(slice => {
      slice.isItem = true
      slice.index = item.index
    })
    this.items.push(item)
  }

  // removeItem simply removes an attribute from the list of items.
  removeItem(item: Attribute) {
    this.items = this.items.filter(i => i.index! !== item.index!)
  }

  // toJSON is used by JSON.parse and JSON.stringify when (de)serializing an object to/from JSON.
  // We omit the parent because we want to serialize an attribute tree as a DAG (directed acyclic graph).
  toJSON() {
    return { ...this, parent: undefined }
  }
}
