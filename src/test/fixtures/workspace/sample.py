def build_feature_map(values):
    return [value * 2 for value in values]


values = [1, 2, 3]
feature_map = build_feature_map(values)
print(feature_map)
