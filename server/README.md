# Backend API Documentation

Technical documentation for the Q-Metrics Generator backend service. This guide enables standalone API usage without the frontend.

## Overview

RESTful API for AutomationML quality metrics manipulation with multi-editor support and automatic score calculation.

**Base URL**: `http://localhost:8080`

## Running the Server

### Using Docker Compose (from generator root, recommended)

```bash
docker compose up backend
```

### Using .NET CLI

```bash
cd server
dotnet restore
dotnet run
```

## API Endpoints

### 1. GET `/api/hierarchy`

Retrieves the complete AML quality metrics hierarchy with all elements, attributes, weightings, and scores.

**Request:**

```bash
curl http://localhost:8080/api/hierarchy
```

**Response** (200 OK):

```json
[
  {
    "instance_hierarchy": "Quality_Metricies",
    "elements": [
      {
        "element_name": "Q_Metric1",
        "element_id": "6e43abbd-fc3c-4d08-9069-0abeb399ed1d",
        "element_description": "Q-Metric",
        "attributes": [...],
        "children": [
          {
            "element_name": "Usability",
            "element_id": "938419bd-f123-4cde-b0d1-824c7f886044",
            "attributes": [...],
            "children": [
              {
                "element_name": "Documentation",
                "element_id": "5cc47e0c-834e-4cfe-a3e0-e2349b6e072e",
                "attributes": [
                  {
                    "attribute_name": "Percentage_Weighting",
                    "editor_id": "default",
                    "attribute_path": "CAEX/InstanceHierarchy[@Name='Quality_Metricies']/InternalElement[@Name='Q_Metric1']/InternalElement[@Name='Usability']/InternalElement[@Name='Documentation']/Attribute[@Name='Percentage_Weighting']",
                    "current_value": null,
                    "editable": false,
                    "constraints": [],
                    "sub_attributes": [
                      {
                        "attribute_name": "weight",
                        "attribute_path": "CAEX/.../Attribute[@Name='weight']",
                        "current_value": "0.2",
                        "editable": true,
                        "constraints": [
                          {
                            "name": "Range",
                            "type": "OrdinalScaledType",
                            "min_value": "0",
                            "max_value": "1"
                          }
                        ]
                      },
                      {
                        "attribute_name": "result",
                        "current_value": "0.2",
                        "editable": false
                      }
                    ]
                  }
                ],
                ],
                "children": [
                  {
                    "element_name": "Parameters",
                    "children": [
                      {
                        "element_name": "data type",
                        "attributes": [
                          {
                            "attribute_name": "Availability",
                            "current_value": null,
                            "sub_attributes": [
                              {
                                "attribute_name": "value",
                                "current_value": "occasionally available",
                                "editable": true,
                                "constraints": [
                                  {
                                    "type": "NominalScaledType",
                                    "required_values": ["not available", "occasionally available", "mostly available", "generally available"]
                                  }
                                ]
                              },
                              {
                                "attribute_name": "value_mapping",
                                "current_value": "0.4",
                                "editable": false
                              },
                              {
                                "attribute_name": "result",
                                "current_value": "0.4",
                                "editable": false
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
]
```

**Response Structure:**

- `instance_hierarchy`: Root hierarchy name
- `elements`: Array of top-level elements
  - `element_name`: Element identifier
  - `element_id`: Unique UUID
  - `element_description`: Human-readable description
  - `attributes`: Element attributes
    - `attribute_name`: Attribute identifier
    - `editor_id`: Editor who created/modified this attribute
    - `attribute_path`: Full CAEX XPath for updates
    - `current_value`: Current attribute value (null for containers)
    - `editable`: Whether attribute can be modified
    - `constraints`: Validation rules (NominalScaledType or OrdinalScaledType)
    - `sub_attributes`: Nested attributes (e.g., weight, result)
  - `children`: Nested elements (recursive structure)

### 2. POST `/api/update-attribute`

Updates a specific attribute value and triggers automatic score recalculation.

**Request:**

```bash
curl -X POST http://localhost:8080/api/update-attribute \
  -H "Content-Type: application/json" \
  -d '{
    "attribute_path": <CAEX Path>,
    "new_value": "generally available",
    "editor_id": "Internal Reviewer"
  }'
```

**Request Body:**

```json
{
  "attribute_path": "string (required)",
  "new_value": "string (required)",
  "editor_id": "string (required, not 'default')"
}
```

**Parameters:**

- `attribute_path`: Full CAEX XPath obtained from GET `/api/hierarchy`
- `new_value`: New value (must match constraint requirements)
- `editor_id`: Unique editor identifier

**Response** (200 OK):

```json
{
  "status": "success"
}
```

**Response** (400 Bad Request):

```json
{
  "error": "editor_id is required and cannot be 'default'"
}
```

**Side Effects:**

1. Updates the specified attribute value
2. For metric `value` attributes: auto-updates `value_mapping` and `result`
3. For `Percentage_Weighting`: creates editor-specific copy if needed
4. Triggers recursive score recalculation for the entire hierarchy
5. Persists changes to AML file on disk

## Architecture

### Component Structure

```
┌─────────────────────────────────────┐
│         ASP.NET Core Host           │
│       (Kestrel, Port 8080)          │
└────────────────┬────────────────────┘
                 │
        ┌────────┴─────────┐
        │                  │
   ┌────┴─────┐    ┌──────┴──────┐
   │   GET    │    │    POST     │
   │/hierarchy│    │/update-attr │
   └────┬─────┘    └──────┬──────┘
        │                 │
        └────────┬────────┘
                 │
        ┌────────┴─────────┐
        │   AMLEditor.cs   │
        │ (Business Logic) │
        └────────┬─────────┘
                 │
        ┌────────┴─────────┐
        │  Aml.Engine      │
        │  (4.4.4)         │
        └────────┬─────────┘
                 │
        ┌────────┴─────────┐
        │   AML Files      │
        │  (.aml on disk)  │
        └──────────────────┘
```

### File Structure

```
server/
├── main.cs                                   # API entry point, endpoints, CORS
├── AMLEditor.cs                              # Core business logic
│   ├── ReadHierarchy()                       # Parse AML → JSON
│   ├── UpdateAttribute()                     # Modify values, save
│   ├── CalculateScore()                      # Recursive scoring
│   └── FindPercentageWeightingByEditorId()   # Helper function
├── generator_backend_cs.csproj               # .NET project config
├── Dockerfile                                # Multi-stage build
└── QualityMetrics_withIntention.aml          # Data file
```

## Core Concepts

### 1. Multi-Editor System

Multiple users can independently weight the same metrics without conflicts.

**Mechanism:**

- Initial state: All elements have `Percentage_Weighting` with `editor_id="default"`
- First edit by `editor1`: Creates a copy with `editor_id="editor1"`
- Each editor has their own `result` scores
- Default weightings remain unchanged

**Example in AML:**

```xml
<InternalElement Name="Usability">
  <!-- Default weighting -->
  <Attribute Name="Percentage_Weighting" editor_id="default">
    <Attribute Name="weight" Value="0.2"/>
    <Attribute Name="result" Value="0.2"/>
  </Attribute>

  <!-- Editor1's custom weighting -->
  <Attribute Name="Percentage_Weighting" editor_id="editor1">
    <Attribute Name="weight" Value="0.35"/>
    <Attribute Name="result" Value="0.67"/>
  </Attribute>
</InternalElement>
```

### 2. Score Calculation Algorithm

Scores flow bottom-up through the hierarchy using weighted averages.

**For Leaf Nodes:**

```
score = value_mapping
```

Example: `value="good"` → `value_mapping="80"` → `result="80"`

**For Parent Nodes:**

```
score = Σ(child_score × child_weight) / Σ(child_weight)
```

Example:

```
Child A: score=90, weight=0.6 → contribution=54
Child B: score=70, weight=0.4 → contribution=28
Parent score = (54 + 28) / (0.6 + 0.4) = 82
```

**Trigger:** Automatic after any `POST /api/update-attribute` call

### 3. Value Mappings

Metrics have discrete value options that map to scores (0-100).

**Defined in AttributeTypeLib:**

```xml
<AttributeType Name="Availability">
  <Attribute Name="value">
    <Constraint><NominalScaledType>
      <RequiredValue>not available</RequiredValue>
      <RequiredValue>occasionally available</RequiredValue>
      <RequiredValue>mostly available</RequiredValue>
      <RequiredValue>generally available</RequiredValue>
    </NominalScaledType></Constraint>
  </Attribute>
  <Attribute Name="value_mapping">
    <Constraint><NominalScaledType>
      <RequiredValue>0.0</RequiredValue>
      <RequiredValue>0.4</RequiredValue>
      <RequiredValue>0.7</RequiredValue>
      <RequiredValue>1.0</RequiredValue>
    </NominalScaledType></Constraint>
  </Attribute>
</AttributeType>
```

**Behavior:** When `value` is updated, `value_mapping` and `result` are automatically synchronized.

## Environment Variables

| Variable                 | Type    | Default               | Description                                                                               |
| ------------------------ | ------- | --------------------- | ----------------------------------------------------------------------------------------- |
| `LOG_LEVEL`              | string  | `Information`         | Console logging level:<br>`Trace`, `Debug`, `Information`, `Warning`, `Error`, `Critical` |
| `INIT_VALUE_INTENTION`   | boolean | `false`               | Initialize value intentions on startup                                                    |
| `ASPNETCORE_URLS`        | string  | `http://0.0.0.0:8080` | Server binding address                                                                    |
| `ASPNETCORE_ENVIRONMENT` | string  | `Production`          | Runtime environment:<br>`Development`, `Production`                                       |

**Example:**

```bash
export LOG_LEVEL=Debug
export ASPNETCORE_URLS=http://+:5000
dotnet run
```

## Usage Examples

### Example 1: Get Current State

```bash
curl -s http://localhost:8080/api/hierarchy | jq '.[0].elements[0].element_name'
# Output: "Q_Metric1"
```

## Usage Examples

### Example 1: Get Complete Hierarchy

```bash
curl http://localhost:8080/api/hierarchy | jq '.'
```

### Example 2: Update Parameter Documentation (data type availability)

**Step 1**: Get hierarchy and save it

```bash
curl http://localhost:8080/api/hierarchy > metrics.json
```

**Step 2**: Find the `attribute_path` for the metric you want to update

```bash
# Search in metrics.json for:
# Usability > Documentation > Parameters > data type > Availability > value
# Copy the attribute_path value
```

**Step 3**: Update using the copied path

```bash
curl -X POST http://localhost:8080/api/update-attribute \
  -H "Content-Type: application/json" \
  -d '{
    "attribute_path": "<CAEX_path>",
    "new_value": "generally available",
    "editor_id": "my_review"
  }'
```

### Example 3: Adjust Documentation Weight

```bash
curl -X POST http://localhost:8080/api/update-attribute \
  -H "Content-Type: application/json" \
  -d '{
    "attribute_path": "<CAEX_path>",
    "new_value": "0.35",
    "editor_id": "my_review"
  }'
```

### Example 4: Check Your Score

```bash
curl -s http://localhost:8080/api/hierarchy | \
  jq '.[] | .elements[0].attributes[] | select(.editor_id=="my_review") | .sub_attributes[] | select(.attribute_name=="result")'
```

**Workflow Tips:**

1. Always GET `/api/hierarchy` first and save to a file
2. Search the JSON for the element you want to update
3. Copy the exact `attribute_path` from the response
4. Use it in your POST request
5. Don't construct paths manually - they're complex and error-prone

## Production Considerations

**Security Notice:**

This API is designed for **local development use only**. It is **not production-ready** and should never be exposed on a network without implementing authentication and further input validation.

**Recommended Deployment:**

- Run locally on individual developer machines
- Use within isolated Docker containers
- Implement file locking for concurrent access scenarios

**Not Recommended:**

- ❌ Direct exposure to company network
- ❌ Public internet access
- ❌ Multi-user production environments without modifications

## Dependencies

| Package                   | Version |
| ------------------------- | ------- |
| Aml.Engine                | 4.4.4   |
| Aml.Engine.Services       | 4.2.5   |
| Microsoft.AspNetCore.App  | 2.2.8   |
| Microsoft.AspNetCore.Cors | 2.3.0   |

Install with:

```bash
dotnet restore
```

## Troubleshooting

**Q: Port 8080 already in use**

```bash
# Use different port
export ASPNETCORE_URLS=http://+:5001
dotnet run
```

**Q: Attribute not found**

```
Verify attribute_path using GET /api/hierarchy response
```

**Q: 400 Bad Request on update**

```
Ensure editor_id is not empty or "default"
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
