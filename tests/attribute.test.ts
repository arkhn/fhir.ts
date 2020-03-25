import { Attribute } from 'attribute'
import { AttributeDefinition } from 'types'
import { notDeepEqual } from 'assert'

const observationCodeDefinition: AttributeDefinition = {
  id: 'Observation.code',
  path: 'Observation.code',
  definition: 'Heart Rate.',
  min: 1,
  max: '1',
  base: {
    path: 'Observation.code',
  },
  type: [
    {
      code: 'CodeableConcept',
    },
  ],
  constraint: [
    {
      key: 'ele-1',
      severity: 'error',
      human: 'All FHIR elements must have a @value or children',
      expression: 'hasValue() or (children().count() > id.count())',
      xpath: '@value|f:*|h:div',
      source: 'http://hl7.org/fhir/StructureDefinition/Element',
    },
  ],
}

const observationIdDefinition: AttributeDefinition = {
  id: 'Observation.id',
  path: 'Observation.id',
  definition:
    'The logical id of the resource, as used in the URL for the resource. Once assigned, this value never changes.',
  min: 0,
  max: '1',
  base: {
    path: 'Resource.id',
  },
  type: [
    {
      extension: [
        {
          url:
            'http://hl7.org/fhir/StructureDefinition/structuredefinition-fhir-type',
          valueUrl: 'string',
        },
      ],
      code: 'http://hl7.org/fhirpath/System.String',
    },
  ],
}

const observationCategorySliceDefinition = {
  id: 'Observation.category:VSCat',
  path: 'Observation.category',
  sliceName: 'VSCat',
  short: 'Classification of  type of observation',
  definition:
    'A code that classifies the general type of observation being made.',
  min: 1,
  max: '1',
  base: {
    path: 'Observation.category',
    min: 0,
    max: '*',
  },
  type: [
    {
      code: 'CodeableConcept',
    },
  ],
}

const observationValueSliceDefinition = {
  id: 'Observation.value[x]:valueQuantity',
  path: 'Observation.value[x]',
  sliceName: 'valueQuantity',
  definition:
    'Vital Signs value are recorded using the Quantity data type. For supporting observations such as Cuff size could use other datatypes such as CodeableConcept.',
  min: 0,
  max: '1',
  base: {
    path: 'Observation.value[x]',
  },
  type: [
    {
      code: 'Quantity',
    },
  ],
}

describe('Attribute', () => {
  it('builds from an AttributeDefinition', () => {
    const attribute = new Attribute(observationCodeDefinition)
    expect(attribute).toMatchInlineSnapshot(`
      Object {
        "children": Array [],
        "definition": Object {
          "base": Object {
            "path": "Observation.code",
          },
          "constraint": Array [
            Object {
              "expression": "hasValue() or (children().count() > id.count())",
              "human": "All FHIR elements must have a @value or children",
              "key": "ele-1",
              "severity": "error",
              "source": "http://hl7.org/fhir/StructureDefinition/Element",
              "xpath": "@value|f:*|h:div",
            },
          ],
          "definition": "Heart Rate.",
          "id": "Observation.code",
          "max": "1",
          "min": 1,
          "path": "Observation.code",
          "type": Array [
            Object {
              "code": "CodeableConcept",
            },
          ],
        },
        "id": "code",
        "isArray": false,
        "isItem": false,
        "isPrimitive": false,
        "isRequired": true,
        "isSlice": false,
        "items": Array [],
        "name": "code",
        "parent": undefined,
        "slices": Array [],
        "types": Array [
          "CodeableConcept",
        ],
      }
    `)
  })

  describe('toJSON', () => {
    it('omits the parent', () => {
      const parent = new Attribute(observationCodeDefinition)
      const child = new Attribute(observationIdDefinition)
      parent.addChild(child)
      expect(child.parent).toBeDefined()
      expect(child.toJSON()).toMatchObject({
        parent: undefined,
      })
      expect(JSON.parse(JSON.stringify(child)).parent).not.toBeDefined()
    })
  })

  describe('from', () => {
    it('recursively copy an attribute', () => {
      const parent = new Attribute(observationCodeDefinition)

      const child1 = new Attribute(observationIdDefinition)
      const child2 = new Attribute(observationIdDefinition)
      const child3 = new Attribute(observationIdDefinition)

      const item1 = new Attribute(observationIdDefinition)
      const item2 = new Attribute(observationIdDefinition)

      const slice = new Attribute(observationCategorySliceDefinition)
      const sliceChild1 = new Attribute(observationIdDefinition)
      const sliceChild2 = new Attribute(observationIdDefinition)

      parent.addChild(child1)

      child1.addChild(child2)

      child2.addChild(child3)

      slice.addChild(sliceChild1)
      slice.addChild(sliceChild2)

      child3.addSlice(slice)
      child3.addItem(item1)
      child3.addItem(item2)

      const copied = Attribute.from(parent)
      expect(JSON.stringify(copied) === JSON.stringify(parent))
    })
  })

  describe('tail', () => {
    it('returns the last element of the path', () => {
      const attr = new Attribute(observationIdDefinition)
      expect(attr.tail).toEqual('id')
    })

    it('adds an index when attribute is an array item', () => {
      const parent = new Attribute(observationCodeDefinition)
      const attr = new Attribute(observationIdDefinition)
      parent.addItem(attr)
      expect(attr.tail).toEqual('id[0]')
    })

    it('handles multi-type slices', () => {
      const slice = new Attribute(observationValueSliceDefinition)
      expect(slice.tail).toEqual('valueQuantity')
    })

    it('handles slice array item', () => {
      const parent = new Attribute(observationCodeDefinition)
      const item = new Attribute(observationCodeDefinition)
      const slice = new Attribute(observationCategorySliceDefinition)
      parent.addItem(item)
      item.addSlice(slice)
      expect(slice.tail).toEqual('category[0]')
    })
  })

  describe('path', () => {
    it('returns the tail if there are no parents', () => {
      const attr = new Attribute(observationIdDefinition)
      expect(attr.path).toEqual('id')
    })

    it('appends the tail to the parent path', () => {
      const attr = new Attribute(observationCodeDefinition)
      const child = new Attribute(observationIdDefinition)
      attr.addChild(child)
      expect(child.path).toEqual('code.id')
    })
  })

  describe('spreadTypes', () => {
    it('generates an array of attribute for each type', () => {
      const multitypeAttributeDefinition = {
        id: 'Observation.value[x]',
        path: 'Observation.value[x]',
        definition:
          'The information determined as a result of making the observation, if the information has a simple value.',
        min: 0,
        max: '1',
        base: {
          path: 'Observation.value[x]',
        },
        type: [
          {
            code: 'Quantity',
          },
          {
            code: 'CodeableConcept',
          },
          {
            code: 'string',
          },
          {
            code: 'boolean',
          },
        ],
      }
      const multiTypeAttr = new Attribute(multitypeAttributeDefinition)
      const generated = multiTypeAttr.spreadTypes()
      expect(generated).toHaveLength(4)
      expect(generated.map(({ path }) => path)).toEqual([
        'valueQuantity',
        'valueCodeableConcept',
        'valueString',
        'valueBoolean',
      ])
    })
  })

  describe('addChild', () => {
    it('adds a child and update the parent', () => {
      const parent = new Attribute(observationCodeDefinition)
      const child = new Attribute(observationIdDefinition)
      parent.addChild(child)
      expect(child.parent).toEqual(parent)
      expect(parent.children).toEqual([child])
    })
  })

  describe('addSlice', () => {
    it('adds a slice and update the parent', () => {
      const parent = new Attribute(observationCodeDefinition)
      const attr = new Attribute(observationIdDefinition)
      const slice = new Attribute(observationValueSliceDefinition)
      parent.addChild(attr)
      attr.addSlice(slice)

      expect(slice.parent).toEqual(parent)
      expect(attr.slices).toEqual([slice])
      expect(slice.isItem).toBe(false)
      expect(slice.index).not.toBeDefined()
    })

    it('handles slice items', () => {
      const array = new Attribute(observationCodeDefinition)
      const item = new Attribute(observationIdDefinition)
      const slice = new Attribute(observationValueSliceDefinition)
      array.addItem(item)
      item.addSlice(slice)

      expect(slice.parent).not.toBeDefined()
      expect(item.slices).toEqual([slice])
      expect(slice.isItem).toBe(true)
      expect(slice.index).toEqual(item.index)
    })
  })

  describe('addItem', () => {
    it('adds an item with and index and update the parent', () => {
      const array = new Attribute(observationCodeDefinition)
      const item = new Attribute(observationIdDefinition)
      array.addItem(item)

      expect(array.items).toEqual([item])
      expect(item.isItem).toBe(true)
      expect(item.index).toEqual(0)
    })

    it('forwards the index to the slices if any', () => {
      const array = new Attribute(observationCodeDefinition)
      const item = new Attribute(observationIdDefinition)
      const slice1 = new Attribute(observationValueSliceDefinition)
      const slice2 = new Attribute(observationValueSliceDefinition)
      item.addSlice(slice1)
      item.addSlice(slice2)

      array.addItem(item)

      expect(slice1.isItem).toBe(true)
      expect(slice1.index).toEqual(item.index)
      expect(slice2.isItem).toBe(true)
      expect(slice2.index).toEqual(item.index)
    })

    it('accepts an optional index', () => {
      const array = new Attribute(observationCodeDefinition)
      const item = new Attribute(observationIdDefinition)

      array.addItem(item, 42)
      expect(item.isItem).toBe(true)
      expect(item.index).toEqual(42)
    })

    it('computes the index', () => {
      const array = new Attribute(observationCodeDefinition)
      const item1 = new Attribute(observationIdDefinition)
      const item2 = new Attribute(observationIdDefinition)
      const item3 = new Attribute(observationIdDefinition)
      const item4 = new Attribute(observationIdDefinition)

      array.addItem(item1, 42)
      array.addItem(item2, 1)
      array.addItem(item3)
      array.addItem(item4)
      expect(item1.index).toEqual(42)
      expect(item2.index).toEqual(1)
      expect(item3.index).toEqual(0)
      expect(item4.index).toEqual(2)

      expect(() => array.addItem(item1, 1)).toThrowError(
        'item with index 1 already exists',
      )
    })
  })

  describe('removeItem', () => {
    it('removes an item from the array', () => {
      const array = new Attribute(observationCodeDefinition)
      const item1 = new Attribute(observationIdDefinition)
      const item2 = new Attribute(observationIdDefinition)
      const item3 = new Attribute(observationIdDefinition)

      array.addItem(item1)
      array.addItem(item2)
      array.addItem(item3)

      array.removeItem(item2)

      expect(array.items).toEqual([item1, item3])
      expect(item2.parent).not.toBeDefined()
    })
  })
})
