import createClient from "openapi-fetch";
import type { paths } from "./schema";
import { BASE_URL } from "../config";

// Create a typed fetch client
const client = createClient<paths>({
  baseUrl: BASE_URL,
  credentials: "include", // Send cookies with all requests
});

// Example usage:
// const { data, error } = await client.GET("/user");
// if (data) {
//   console.log(data.name, data.id); // Fully typed!
// }

export default client;
