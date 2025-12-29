import { View, Text, StyleSheet } from "react-native";
import { useAuth } from "../src/contexts/AuthContext";
import { Button } from "../src/components/Button";
import { useRouter } from "expo-router";

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/(auth)/login");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bienvenido a Finnon</Text>
      <Text style={styles.text}>Email: {user?.email}</Text>
      <Text style={styles.text}>ID: {user?.id}</Text>

      <View style={styles.buttonContainer}>
        <Button title="Cerrar sesión" onPress={handleSignOut} variant="secondary" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  text: {
    fontSize: 16,
    marginVertical: 4,
    color: "#666",
  },
  buttonContainer: {
    marginTop: 32,
    width: "100%",
  },
});
