package com.monarch.shadow.utils;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public class Utils {

    public String escapeJson(Object obj) {
        if (obj == null) return "";
        return obj.toString()
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    public static String extractFieldIds(String jsonString) {
        JSONObject root = new JSONObject(jsonString);
        JSONArray elements = root.optJSONArray("elements");

        List<String> ids = new ArrayList<>();
        extractIdsRecursive(elements, ids);

        return String.join(",", ids);
    }

    private static void extractIdsRecursive(JSONArray elements, List<String> ids) {
        if (elements == null) return;

        for (int i = 0; i < elements.length(); i++) {
            JSONObject obj = elements.getJSONObject(i);

            // Ambil dan simpan "id" jika ada
            if (obj.has("properties")) {
                JSONObject props = obj.getJSONObject("properties");
                if (props.has("id")) {
                    String id = props.optString("id");
                    if (!id.isEmpty()) {
                        ids.add(id);
                    }
                }
            }

            // Lakukan rekursi jika ada "elements"
            if (obj.has("elements")) {
                JSONArray childElements = obj.getJSONArray("elements");
                extractIdsRecursive(childElements, ids); // Rekursif ke dalam
            }
        }
    }
}
