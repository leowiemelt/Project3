import json

with open("calfire.geojson") as f:
    data = json.load(f)

filtered = []

for feature in data["features"]:

    props = feature["properties"]

    year = str(props.get("YEAR_", ""))

    if year == "2020":
        filtered.append(feature)

small = {
    "type": "FeatureCollection",
    "features": filtered
}

with open("calfire_2020.geojson", "w") as f:
    json.dump(small, f)

print(len(filtered))