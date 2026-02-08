import "./config.js";
import { app } from "./app.js";

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`AI News server running on port ${PORT}`);
});
