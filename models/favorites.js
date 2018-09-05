module.exports = function(sequelize, DataTypes) {
  var Favorites = sequelize.define("Favorites", {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      len: [1]
    },
    postId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        len: [1]
      }
    },
    postingUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      len: [1]
    }
  });

  Favorites.associate = function(models) {
    // We're saying that a Favorites should belong to an User
    // A Favorites can't be created without an User due to the foreign key constraint
    Favorites.belongsTo(models.User, {
      foreignKey: {
        allowNull: false
      }
    });
  };

  return Favorites;
};
