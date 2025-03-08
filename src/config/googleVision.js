const {
  DocumentProcessorServiceClient
} = require("@google-cloud/documentai").v1;
const fs = require("fs").promises;
const mongoose = require("mongoose");
const Product = require("../models/Product"); // Assuming the Product schema is in models/Product.js

const projectId = process.env.GOOGLE_PROJECTID;
const location = "us";
const processorId = process.env.GOOGLE_PROCESSORID;

// MongoDB Connection Setup
// const connectToDatabase = async () => {
//   try {
//     await mongoose.connect(process.env.MONGODB_URI, {
//       useNewUrlParser: true,
//       useUnifiedTopology: true,
//     });
//     console.log("Connected to MongoDB");
//   } catch (err) {
//     console.error("MongoDB connection error:", err);
//     throw err;
//   }
// };

function getText(textAnchor, text) {
  if (!textAnchor.textSegments || textAnchor.textSegments.length === 0) {
    return "";
  }
  const startIndex = textAnchor.textSegments[0].startIndex || 0;
  const endIndex = textAnchor.textSegments[0].endIndex;

  if (startIndex !== undefined && endIndex !== undefined) {
    return text.substring(startIndex, endIndex).replace(/\n/g, " "); // Remove all \n
  } else {
    console.warn("Warning: Invalid text anchor. Returning an empty string.");
    return "";
  }
}

const googleVision = async ({ filePath }) => {
  try {
    // Step 1: Connect to MongoDB
    // await connectToDatabase();

    const client = new DocumentProcessorServiceClient();
    const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

    const document = await fs.readFile(filePath);

    const request = {
      name,
      skipHumanReview: true,
      rawDocument: {
        content: document,
        mimeType: "application/pdf"
      }
    };

    const [response] = await client.processDocument(request);

    const { document: documentText } = response;
    const { pages } = documentText;

    let prescribedMedicinesData = [];

    for (const page of pages) {
      if (page.tables && page.tables.length > 0) {
        for (const table of page.tables) {
          const headerRow = table.headerRows[0]; // Assuming the first header row contains the column names
          const headerCells = headerRow.cells.map((cell) =>
            getText(cell.layout.textAnchor, documentText.text)
          );

          // Find the index of the "Prescribed Medicines" column
          const prescribedMedicinesIndex = headerCells.findIndex(
            (header) => header.trim().toLowerCase() === "prescribed medicines"
          );

          if (prescribedMedicinesIndex === -1) {
            console.warn(
              `No "Prescribed Medicines" column found on page ${page.pageNumber}`
            );
            continue;
          }

          // Extract data under the "Prescribed Medicines" column, only for odd-numbered rows
          table.bodyRows.forEach((bodyRow, rowIndex) => {
            if ((rowIndex + 1) % 2 !== 0) {
              // Check for odd-numbered rows
              const bodyCells = bodyRow.cells.map((cell) =>
                getText(cell.layout.textAnchor, documentText.text)
              );
              if (bodyCells[prescribedMedicinesIndex]) {
                prescribedMedicinesData.push(
                  bodyCells[prescribedMedicinesIndex].trim()
                );
              }
            }
          });
        }
      }
    }

    console.log(
      "Prescribed Medicines Data (Odd Rows Only):",
      prescribedMedicinesData
    );

    // Step 2: Search for products in the database
    for (const medicineName of prescribedMedicinesData) {
      const product = await Product.findOne({
        name: medicineName,
        status: "active"
      }); // Only fetch active products
      if (product) {
        console.log(`Product found: ${product.name}, adding to cart...`);
        // Here, you can add logic to insert into a cart collection or handle cart logic
      } else {
        console.warn(`Medicine "${medicineName}" not found or inactive.`);
      }
    }

    return { data: prescribedMedicinesData, error: null };
  } catch (err) {
    console.error("Error:", err);
    return { data: null, error: err.message };
  }
};

module.exports = googleVision;
