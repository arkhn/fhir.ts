import { structurize, isChildOf } from 'definition'

import * as heartrateProfile from './fixtures/heartrate-profile.json'
import * as mockDefinition from './fixtures/mockDefinition.json'
import * as definitionWithSlices from './fixtures/definitionWithSlices.json'
import { AttributeDefinition } from 'types'

describe('isChildOf', () => {
  it('returns true if a definition is a parent of the other', () => {
    const parent = {
      path: 'Resource.a',
    } as AttributeDefinition
    const child = {
      path: 'Resource.a.b',
    } as AttributeDefinition
    expect(isChildOf(child, parent)).toBe(true)
  })

  it('works with nested path', () => {
    const parent = {
      path: 'Resource.a.b.c.d',
    } as AttributeDefinition
    const child = {
      path: 'Resource.a.b.c.d.e',
    } as AttributeDefinition
    expect(isChildOf(child, parent)).toBe(true)
  })

  it('returns false when path do not match', () => {
    const parent = {
      path: 'Resource.a',
    } as AttributeDefinition
    const child = {
      path: 'Resource.b',
    } as AttributeDefinition
    expect(isChildOf(child, parent)).toBe(false)
  })

  it('returns false when path are equal', () => {
    const parent = {
      path: 'Resource.a',
    } as AttributeDefinition
    const child = {
      path: 'Resource.a',
    } as AttributeDefinition
    expect(isChildOf(child, parent)).toBe(false)
  })
})

describe('structurize', () => {
  it('raises when the snapshot is missing', () => {
    expect(() => structurize({})).toThrowErrorMatchingInlineSnapshot(
      `"Snapshot is needed in the structure definition."`,
    )
  })

  it('builds a structured version of a mock StructureDefinition (snapshot)', () => {
    const structured = structurize(mockDefinition.resource)
    expect(structured).toMatchSnapshot()
  })

  it('builds a structured version of a real StructureDefinition (snapshot)', () => {
    const structured = structurize(heartrateProfile.resource)
    expect(structured).toMatchSnapshot()
  })

  it('builds a structured version of a mock StructureDefinition', () => {
    const structured = structurize(mockDefinition.resource)

    expect(structured.meta).toEqual({
      baseDefinition: 'http://hl7.org/fhir/StructureDefinition/super-mock',
      constraint: [
        {
          key: 'dom-2',
          severity: 'error',
          human:
            'If the resource is contained in another resource, it SHALL NOT contain nested Resources',
          expression: 'contained.contained.empty()',
          xpath: 'not(parent::f:contained and f:contained)',
          source: 'http://hl7.org/fhir/StructureDefinition/DomainResource',
        },
      ],
      derivation: 'constraint',
      description: 'FHIR Heart Rate Profile',
      id: 'mock',
      kind: 'resource',
      max: '1',
      min: 0,
      name: 'Mock',
      publisher: 'Arkhn dev team',
      type: 'Mock',
      url: 'http://hl7.org/fhir/StructureDefinition/mock',
    })

    expect(structured.attributes).toHaveLength(2)
    expect(structured.attributes![0].children).toHaveLength(2)
    expect(structured.attributes![0].children[0].children).toHaveLength(1)
    expect(
      structured.attributes![0].children[0].children[0].children,
    ).toHaveLength(0)
    expect(structured.attributes![0].children[1].children).toHaveLength(0)
    expect(structured.attributes![1].children).toHaveLength(1)
    expect(structured.attributes![1].children[0].children).toHaveLength(0)
  })

  it('handles primitive types', () => {
    const structured = structurize({
      resourceType: 'StructureDefinition',
      id: 'mock',
      kind: 'primitive-type',
      derivation: 'constraint',
      snapshot: { element: [{}] },
    })
    expect(structured.attributes).not.toBeDefined()
    expect(structured.meta).toMatchObject({ kind: 'primitive-type' })
  })

  it('handles slices (snapshot)', () => {
    const structured = structurize(definitionWithSlices.resource)

    expect(structured).toMatchSnapshot()
  })

  it('handles slices', () => {
    const structured = structurize(definitionWithSlices.resource)

    expect(structured.attributes).toHaveLength(1)
    expect(structured.attributes![0].children).toHaveLength(0)
    expect(structured.attributes![0].slices).toHaveLength(1)
    expect(structured.attributes![0].slices[0].children).toHaveLength(1)
  })
})
