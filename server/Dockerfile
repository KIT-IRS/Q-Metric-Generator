FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app

COPY generator_backend_cs.sln ./
COPY generator_backend_cs.csproj ./
RUN dotnet restore

COPY . ./

# Build the project
RUN dotnet publish generator_backend_cs.csproj -c Release -o out

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/out ./
COPY *.aml ./

# Expose port (change if your app uses a different port)
EXPOSE 8080

# Run the application
ENTRYPOINT ["dotnet", "generator_backend_cs.dll"]