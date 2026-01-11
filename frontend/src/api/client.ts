import createClient from "openapi-fetch";
import type { paths } from "./schema";

// Create a typed fetch client
const client = createClient<paths>({
  baseUrl: "http://localhost:3000",
  credentials: "include", // Send cookies with all requests
});

// Example usage:
// const { data, error } = await client.GET("/user");
// if (data) {
//   console.log(data.name, data.id); // Fully typed!
// }

export default client;
