import { AttributeDefinition, ResourceDefinition } from './types'

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

interface TypeElement {
  code: string
  profile?: string[]
  targetProfile?: string[]
  extension?: {
    url: string
    valueUrl?: string
  }[]
}

// computeType transforms a FHIR 'Element' into a single definitionId
// that can be fetched from the FHIR API.
// It may be a either:
// - a basic resource/complex-type/primitive-type (element.code)
// - a profile (element.profile[0])
// - an extension (element.extension[0].url)
const computeType = (element: TypeElement): string => {
  if (element.extension && element.extension.length > 0) {
    return (
      element.extension[0].valueUrl ||
      element.extension[0].url.split('/').pop()!
    )
  }
  if (element.profile && element.profile.length > 0) {
    return element.profile[0].split('/').pop()!
  }
  return element.code
}

// Attribute is the class used to represent hierarchically a FHIR resource based on its StructureDefinition.
export class Attribute {
  parent?: Attribute
  children: Attribute[]
  choices: Attribute[]
  slices: Attribute[]
  items: Attribute[]

  id: string
  name: string
  definition: AttributeDefinition
  extensions?: ResourceDefinition[]
  types: string[]

  isSlice: boolean
  isItem: boolean
  isPrimitive: boolean

  index?: number

  // the Attribute class must be initialized with an AttributeDefinition, which
  // is a single item of the snapshot.element array of a StructureDefinition.
  constructor(definition: AttributeDefinition) {
    this.children = []
    this.choices = []
    this.slices = []
    this.items = []

    this.definition = JSON.parse(JSON.stringify(definition))
    this.id = definition.id.split('.').pop()!
    this.name = definition.path.split('.').pop()!
    this.isSlice = !!definition.sliceName
    this.isItem = false

    this.types = (definition.type || []).map(computeType)

    this.isPrimitive =
      this.types.length > 1
        ? false
        : PRIMITIVE_TYPES.includes(this.types[0])
        ? true
        : false
  }

  get isRequired(): boolean {
    return this.definition.min > 0
  }
  get isArray(): boolean {
    return this.definition.max === '*' || Number(this.definition.max) > 1
  }
  get isReferenceType(): boolean {
    return this.types[0] === 'uri' && this.parent?.types[0] === 'Reference'
  }
  get isRootIdentifier(): boolean {
    return !this.parent && this.types[0] === 'Identifier'
  }
  get isExtension(): boolean {
    return this.types[0] === 'Extension'
  }

  // tail returns the last element of the attribute path
  get tail(): string {
    let tail = this.name || ''

    if (this.isSlice) {
      tail = this.name.includes('[x]') ? this.definition.sliceName! : this.name
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
    serialized.children.forEach((child: Attribute) =>
      attr.addChild(Attribute.from(child)),
    )
    serialized.choices.forEach((choice: Attribute) =>
      attr.addChoice(Attribute.from(choice)),
    )
    serialized.slices.forEach((slice: Attribute) =>
      attr.addSlice(Attribute.from(slice)),
    )
    serialized.items.forEach(() => attr.addItem())
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
  // addChoice adds a choice type attribute to this and update its parent with the current parent.
  // Note that if this attribute is an item of an array, the slice must be an item as well (and we pass along the current index)
  addChoice(choice: Attribute) {
    choice.parent = this.parent
    this.choices.push(choice)
  }

  // addSlice adds a slice attribute to this and update the parent of the slice with the current parent.
  addSlice(slice: Attribute) {
    slice.parent = this
    this.slices.push(slice)
  }

  // addItem adds an item to this and update the parent of the item with the current parent.
  // The index may be provided (in case the attribute already exists in the db and has a pre-defined index)
  // Otherwise the index is computed with the first available index.
  // If the added item has slices, we must pass along the item's index.
  addItem(index?: number, attr?: Attribute): Attribute {
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

    if (!this.isArray) {
      throw new Error(
        `trying to add an item to non-array attribute ${this.path}`,
      )
    }
    const item = Attribute.from(attr || this)

    item.definition.max = '1'
    item.parent = this.parent
    item.isItem = true
    item.index = computeIndex()
    item.choices.forEach(choice => {
      choice.isItem = true
      choice.index = item.index
    })
    item.extensions = this.extensions
    this.items.push(item)

    return item
  }

  // removeItem simply removes an attribute from the list of items.
  removeItem(item: Attribute) {
    item.parent = undefined
    this.items = this.items.filter(i => i.index! !== item.index!)
  }

  // addExtension finds the "extension" child of an attribute (if any)
  // and add an item to this array attribute. The child has a custom definitionId
  // which is a profile on the Extension type.
  addExtension(definitionId: string, index?: number) {
    const childExtension = this.children.find(c => c.isExtension)
    if (!childExtension)
      throw new Error(`attribute ${this.path} has no extension child`)

    const ext = new Attribute({
      ...childExtension.definition,
      type: [{ code: 'Extension', extension: [{ valueUrl: definitionId }] }],
    })
    return childExtension.addItem(index, ext)
  }

  // toJSON is used by JSON.parse and JSON.stringify when (de)serializing an object to/from JSON.
  // We omit the parent because we want to serialize an attribute tree as a DAG (directed acyclic graph).
  toJSON() {
    return { ...this, parent: undefined }
  }
}
