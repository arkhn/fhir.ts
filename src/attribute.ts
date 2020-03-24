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

  get tail(): string {
    // if element has an index, return the index in brackets
    let tail = this.name || ''

    if (this.isSlice) {
      tail = this.name.includes('[x]') ? this.definition.sliceName : this.name
    }

    return this.isItem ? `${tail}[${this.index}]` : tail
  }

  get path(): string {
    // if not parent, returns the tail
    if (!this.parent) {
      return this.tail
    }

    // else, join the parent to the current element with a '.'
    return `${this.parent.path}.${this.tail}`
  }

  static from(serialized: any): Attribute {
    const attr = new Attribute(serialized.definition)
    attr.isItem = serialized.isItem
    attr.index = serialized.index
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

  isChild(p: Attribute): boolean {
    let current = this as Attribute | undefined
    while (current) {
      if (current.equals(p)) return true
      current = current.parent
    }
    return false
  }

  addChild(child: Attribute) {
    child.parent = this
    this.children.push(child)
  }

  addSlice(slice: Attribute) {
    slice.parent = this.parent
    if (this.isItem) {
      slice.isItem = true
      slice.index = this.index
    }
    this.slices.push(slice)
  }

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

  removeItem(item: Attribute) {
    this.items = this.items.filter(i => i.index! !== item.index!)
  }

  toJSON() {
    return { ...this, parent: undefined }
  }

  equals(p: Attribute) {
    return this.path === p.path
  }
}
