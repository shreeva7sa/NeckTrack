import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
} from "react-native";
import { VictoryChart, VictoryLine, VictoryAxis } from "victory-native";
import { BleManager } from "react-native-ble-plx";
import { atob } from "react-native-quick-base64";
import LinearGradient from "react-native-linear-gradient";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import * as Progress from "react-native-progress";

const bleManager = new BleManager();
const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const STEP_DATA_CHAR_UUID = "beefcafe-36e1-4688-b7f5-00000000000b";

const FOOD_ITEMS = ["Water", "Curd", "Banana", "Apple"];

const AgeSelectionScreen = ({ onSelectAgeGroup }) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={["#4e54c8", "#8f94fb"]} style={styles.gradient}>
        <View style={styles.ageSelectionContainer}>
          <Text style={styles.ageTitle}>Select Your Age Group</Text>
          {["2-15", "16-45", "45+"].map((group) => (
            <TouchableOpacity
              key={group}
              style={styles.ageButton}
              onPress={() => onSelectAgeGroup(group)}
            >
              <Text style={styles.ageButtonText}>{group}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
};

const MainScreen = ({ ageGroup }) => {
  const [analogValue, setAnalogValue] = useState(0);
  const [averageTime, setAverageTime] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState("Searching...");
  const [analogData, setAnalogData] = useState([]);
  const [foodIndex, setFoodIndex] = useState(-1); // Start with no food selected.
  const [previousAverage, setPreviousAverage] = useState(0);
  const [startTime] = useState(Date.now());

  const addDataPoint = (newAnalogValue) => {
    setAnalogData((prevData) => {
      const updatedData = [
        ...prevData,
        { x: (Date.now() - startTime) / 1000, y: newAnalogValue },
      ];
      if (updatedData.length > 20) updatedData.shift();
      return updatedData;
    });
  };

  const connectToDevice = (device) => {
    device
      .connect()
      .then((device) => {
        setConnectionStatus("Connected");
        return device.discoverAllServicesAndCharacteristics();
      })
      .then((device) => device.services())
      .then((services) => {
        let service = services.find((service) => service.uuid === SERVICE_UUID);
        return service.characteristics();
      })
      .then((characteristics) => {
        const stepDataCharacteristic = characteristics.find(
          (char) => char.uuid === STEP_DATA_CHAR_UUID
        );
        stepDataCharacteristic.monitor((error, char) => {
          if (error) {
            console.error(error);
            return;
          }
          const rawData = atob(char.value);
          const dataParts = rawData.split(",");
          let analog = 0,
            avg = 0;

          dataParts.forEach((part) => {
            const [label, value] = part.split(":");
            if (label === "Analog") analog = parseInt(value, 10);
            if (label === "Avg") avg = parseFloat(value);
          });

          setAnalogValue(analog);
          updateAverageAndFood(avg);
          addDataPoint(analog);
        });
      })
      .catch((error) => console.log("Connection error:", error));
  };

  const updateAverageAndFood = (newAverage) => {
    setAverageTime((prev) => {
      if (Math.abs(prev - newAverage) >= 2) {
        setFoodIndex((prevIndex) => (prevIndex + 1) % FOOD_ITEMS.length);
        return newAverage;
      }
      return prev;
    });
  };

  useEffect(() => {
    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) return console.error(error);
      if (device.name === "ESP32_BLE") {
        bleManager.stopDeviceScan();
        setConnectionStatus("Connecting...");
        connectToDevice(device);
      }
    });
  }, []);

  const getIntensityColor = () => {
    if (averageTime >= 700 && averageTime <= 900) return "#4CAF50"; // Green for "Good"
    if (averageTime < 700) return "#FFEB3B"; // Yellow for "Low"
    return "#F44336"; // Red for "High"
  };

  const getIntensityLabel = () => {
    if (averageTime >= 700 && averageTime <= 900) return "Good";
    if (averageTime < 700) return "Low";
    return "High";
  };

  const intensityProgress = (averageTime - 350) / (1600 - 350);

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={["#4e54c8", "#8f94fb"]} style={styles.gradient}>
        <View style={styles.container}>
          <Text style={styles.connectionStatus}>{connectionStatus}</Text>

          <View style={styles.readingsContainer}>
            <Text style={styles.readings}>
              Analog: <Text style={styles.boldText}>{analogValue}</Text> |
              Average:{" "}
              <Text style={styles.boldText}>{averageTime.toFixed(2)} ms</Text> |
              Age Group: <Text style={styles.boldText}>{ageGroup}</Text>
            </Text>
            <View style={styles.intensityContainer}>
              <Icon name="speedometer" size={24} color={getIntensityColor()} />
              <Text
                style={[styles.intensityLabel, { color: getIntensityColor() }]}
              >
                Intensity: {getIntensityLabel()}
              </Text>
            </View>
            <Progress.Circle
              size={100}
              progress={intensityProgress}
              showsText={true}
              color={getIntensityColor()}
              borderWidth={2}
              style={styles.progressCircle}
            />
          </View>

          <VictoryChart>
            <VictoryAxis
              label="Time (s)"
              style={{
                axisLabel: { padding: 30, fontSize: 14, fill: "#ffffff" },
                tickLabels: { fontSize: 10, padding: 5, fill: "#cccccc" },
              }}
            />
            <VictoryAxis
              dependentAxis
              label="Analog Value"
              style={{
                axisLabel: { padding: 35, fontSize: 14, fill: "#ffffff" },
                tickLabels: { fontSize: 10, padding: 5, fill: "#cccccc" },
              }}
            />
            <VictoryLine
              data={analogData}
              x="x"
              y="y"
              style={{
                data: { stroke: "#fbc02d", strokeWidth: 2 },
              }}
            />
          </VictoryChart>

          <View style={styles.foodContainer}>
            <Text style={styles.foodLabel}>
              Type:{" "}
              <Text style={styles.foodItem}>
                {foodIndex === -1 ? "N/A" : FOOD_ITEMS[foodIndex]}
              </Text>
            </Text>
            {foodIndex !== -1 && (
              <Text style={styles.foodAverage}>
                Average: {averageTime.toFixed(2)} ms
              </Text>
            )}
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
};

export default function App() {
  const [ageGroup, setAgeGroup] = useState(null);

  if (!ageGroup) {
    return <AgeSelectionScreen onSelectAgeGroup={setAgeGroup} />;
  }

  return <MainScreen ageGroup={ageGroup} />;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  gradient: { flex: 1 },
  ageSelectionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  ageTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 20,
  },
  ageButton: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 15,
    marginVertical: 10,
    width: "60%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  ageButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#4e54c8",
  },
  container: { flex: 1, alignItems: "center", paddingVertical: 20 },
  connectionStatus: { fontSize: 18, color: "#fff", marginBottom: 10 },
  readingsContainer: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    width: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  readings: {
    fontSize: 16,
    color: "#333333",
    marginBottom: 8,
  },
  boldText: {
    fontWeight: "bold",
  },
  intensityContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  intensityLabel: {
    fontSize: 18,
    fontWeight: "600",
    marginLeft: 8,
  },
  progressCircle: {
    marginTop: 10,
  },
  foodContainer: {
    marginTop: 20,
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  foodLabel: {
    fontSize: 18,
    color: "#4e54c8",
    fontWeight: "bold",
  },
  foodItem: {
    fontSize: 20,
    color: "#f57c00",
    fontWeight: "bold",
  },
  foodContainer: {
    marginTop: 20,
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  foodLabel: {
    fontSize: 18,
    color: "#4e54c8",
    fontWeight: "bold",
  },
  foodItem: {
    fontSize: 20,
    color: "#f57c00",
    fontWeight: "bold",
  },
  foodAverage: {
    marginTop: 5,
    fontSize: 16,
    color: "#333",
  },
});
