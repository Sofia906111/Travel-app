package com.accessway.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Tune
import androidx.compose.ui.graphics.vector.ImageVector

enum class Destination(
    val label: String,
    val icon: ImageVector,
    val contentDescription: String,
) {
    EXPLORE(
        label = "Explore",
        icon = Icons.Filled.Place,
        contentDescription = "Explore places",
    ),
    SAVED(
        label = "Saved",
        icon = Icons.Filled.Bookmark,
        contentDescription = "Saved places",
    ),
    CONTRIBUTE(
        label = "Contribute",
        icon = Icons.Filled.Add,
        contentDescription = "Add a new place",
    ),
    PREFERENCES(
        label = "Preferences",
        icon = Icons.Filled.Tune,
        contentDescription = "Change preferences",
    ),
}
